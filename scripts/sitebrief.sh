#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
STATE_DIR="${SITEBRIEF_STATE_DIR:-$PROJECT_ROOT/.sitebrief}"
API_ENV_FILE="$API_DIR/.env"
ENV_TEMPLATE="$PROJECT_ROOT/.env.example"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
API_PID_FILE="$STATE_DIR/api.pid"
WEB_PID_FILE="$STATE_DIR/web.pid"
API_LOG_FILE="$STATE_DIR/api.log"
WEB_LOG_FILE="$STATE_DIR/web.log"
JWT_TEMPLATE_PLACEHOLDER='change-me-in-production-min-32-chars'
JWT_DEV_PLACEHOLDER='dev-secret-change-in-production'
PROCESS_START_WAIT_SECONDS=3
PROCESS_STOP_MAX_ATTEMPTS=20

say() {
  printf '[sitebrief] %s\n' "$*"
}

warn() {
  printf '[sitebrief] warning: %s\n' "$*" >&2
}

fail() {
  printf '[sitebrief] error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
Usage: sitebrief.sh [install|start|stop|restart|update|status|help]

Commands:
  install   Install dependencies, prepare env + database, and start all services
  start     Start Docker services, API, and web dashboard
  stop      Stop API, web dashboard, and Docker services
  restart   Restart everything managed by this script
  update    Pull latest code, reinstall dependencies, migrate, and restart
  status    Show process and Docker status
USAGE
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_commands() {
  local missing=()
  local command_name

  for command_name in "$@"; do
    if ! command_exists "$command_name"; then
      missing+=("$command_name")
    fi
  done

  if ((${#missing[@]})); then
    fail "Missing prerequisites: ${missing[*]}. Please install them and rerun."
  fi
}

require_docker_compose() {
  command_exists docker || fail 'Missing prerequisite: docker'
  docker compose version >/dev/null 2>&1 || fail 'Missing prerequisite: docker compose plugin'
}

docker_compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

run_in_project() {
  (
    cd "$PROJECT_ROOT"
    "$@"
  )
}

run_in_api() {
  (
    cd "$API_DIR"
    "$@"
  )
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

get_env_value() {
  local key="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  awk -v key="$key" 'index($0, key "=") == 1 { print substr($0, length(key) + 2) }' "$file" | tail -n 1 || true
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp_file

  tmp_file="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
}

generate_jwt_secret() {
  if command_exists openssl; then
    openssl rand -hex 32
  else
    printf 'sitebrief-dev-%s' "$(date +%s)"
  fi
}

ensure_env_file() {
  [[ -f "$ENV_TEMPLATE" ]] || fail "Missing env template: $ENV_TEMPLATE"

  if [[ ! -f "$API_ENV_FILE" ]]; then
    cp "$ENV_TEMPLATE" "$API_ENV_FILE"
    say 'Created apps/api/.env from .env.example'
  fi

  [[ -n "${DATABASE_URL:-}" ]] && upsert_env_var DATABASE_URL "$DATABASE_URL" "$API_ENV_FILE"
  [[ -n "${REDIS_HOST:-}" ]] && upsert_env_var REDIS_HOST "$REDIS_HOST" "$API_ENV_FILE"
  [[ -n "${REDIS_PORT:-}" ]] && upsert_env_var REDIS_PORT "$REDIS_PORT" "$API_ENV_FILE"
  [[ -n "${FRONTEND_URL:-}" ]] && upsert_env_var FRONTEND_URL "$FRONTEND_URL" "$API_ENV_FILE"
  [[ -n "${PORT:-}" ]] && upsert_env_var PORT "$PORT" "$API_ENV_FILE"
  [[ -n "${OPENAI_API_KEY:-}" ]] && upsert_env_var OPENAI_API_KEY "$OPENAI_API_KEY" "$API_ENV_FILE"

  local current_jwt_secret
  current_jwt_secret="$(get_env_value JWT_SECRET "$API_ENV_FILE")"
  if [[ -n "${JWT_SECRET:-}" ]]; then
    upsert_env_var JWT_SECRET "$JWT_SECRET" "$API_ENV_FILE"
  elif [[ -z "$current_jwt_secret" || "$current_jwt_secret" == "$JWT_TEMPLATE_PLACEHOLDER" || "$current_jwt_secret" == "$JWT_DEV_PLACEHOLDER" ]]; then
    upsert_env_var JWT_SECRET "$(generate_jwt_secret)" "$API_ENV_FILE"
    say 'Generated a local JWT secret in apps/api/.env'
  fi
}

load_api_env() {
  [[ -f "$API_ENV_FILE" ]] || fail "Missing API env file: $API_ENV_FILE"

  while IFS= read -r -d '' entry; do
    export "$entry"
  done < <(
    node - "$API_ENV_FILE" <<'NODE'
const fs = require('node:fs');

const envFile = process.argv[2];
const content = fs.readFileSync(envFile, 'utf8');

function parseEnvFile(source) {
  const env = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const line = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
    } else {
      const commentIndex = value.search(/\s#/);
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    env[key] = value;
  }

  return env;
}

for (const [key, value] of Object.entries(parseEnvFile(content))) {
  process.stdout.write(`${key}=${value}\0`);
}
NODE
  )
}

warn_for_optional_env() {
  local openai_key
  openai_key="$(get_env_value OPENAI_API_KEY "$API_ENV_FILE")"

  if [[ -z "$openai_key" || "$openai_key" == 'sk-...' ]]; then
    warn 'OPENAI_API_KEY is not configured; embeddings and idea generation will stay disabled until you add it to apps/api/.env.'
  fi
}

install_dependencies() {
  say 'Installing npm workspaces'
  run_in_project npm install
}

ensure_dependencies() {
  if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
    install_dependencies
  fi
}

wait_for_service() {
  local service_name="$1"
  local timeout_seconds="${2:-60}"
  local deadline=$((SECONDS + timeout_seconds))
  local container_id
  local status

  while (( SECONDS < deadline )); do
    container_id="$(docker_compose ps -q "$service_name" 2>/dev/null || true)"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$status" == 'healthy' || "$status" == 'running' ]]; then
        say "$service_name is ready ($status)"
        return 0
      fi
    fi
    sleep 2
  done

  fail "Timed out waiting for $service_name to become ready"
}

start_infra() {
  say 'Starting PostgreSQL and Redis'
  docker_compose up -d
  wait_for_service postgres 90
  wait_for_service redis 90
}

prepare_database() {
  say 'Generating Prisma client'
  run_in_project npm run db:generate --workspace=apps/api

  say 'Applying Prisma migrations'
  run_in_api npm exec prisma migrate deploy
}

is_pid_running() {
  local pid_file="$1"
  local pid

  [[ -f "$pid_file" ]] || return 1
  pid="$(cat "$pid_file")"
  is_numeric_pid "$pid" || {
    rm -f "$pid_file"
    return 1
  }

  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  rm -f "$pid_file"
  return 1
}

is_numeric_pid() {
  local pid="$1"

  [[ "$pid" =~ ^[0-9]+$ ]]
}

start_process() {
  local label="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3
  local command_args=("$@")

  if is_pid_running "$pid_file"; then
    say "$label is already running (pid $(cat "$pid_file"))"
    return 0
  fi

  : > "$log_file"
  (
    cd "$PROJECT_ROOT"
    if command_exists setsid; then
      setsid "${command_args[@]}" >> "$log_file" 2>&1 < /dev/null &
    else
      nohup "${command_args[@]}" >> "$log_file" 2>&1 < /dev/null &
    fi
    echo $! > "$pid_file"
  )

  sleep "$PROCESS_START_WAIT_SECONDS"
  if ! is_pid_running "$pid_file"; then
    tail -n 20 "$log_file" || true
    fail "$label failed to start. Check $log_file"
  fi

  say "Started $label (pid $(cat "$pid_file")); log: $log_file"
}

get_process_group_id() {
  local pid="$1"

  ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]'
}

stop_process() {
  local label="$1"
  local pid_file="$2"
  local pid
  local group_id
  local attempt=0

  if ! is_pid_running "$pid_file"; then
    say "$label is not running"
    return 0
  fi

  pid="$(cat "$pid_file")"
  group_id="$(get_process_group_id "$pid")"
  if [[ -n "$group_id" && "$group_id" == "$pid" ]]; then
    kill -- "-$group_id" 2>/dev/null || true
  else
    kill "$pid" 2>/dev/null || true
  fi

  while (( attempt < PROCESS_STOP_MAX_ATTEMPTS )); do
    if [[ -n "$group_id" && "$group_id" == "$pid" ]]; then
      if ! kill -0 "-$group_id" 2>/dev/null; then
        rm -f "$pid_file"
        say "Stopped $label"
        return 0
      fi
    elif ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      say "Stopped $label"
      return 0
    fi
    ((attempt += 1))
    sleep 1
  done

  if [[ -n "$group_id" && "$group_id" == "$pid" ]]; then
    kill -9 -- "-$group_id" 2>/dev/null || true
  else
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
  say "Force-stopped $label"
}

start_apps() {
  start_process 'API' "$API_PID_FILE" "$API_LOG_FILE" npm run dev --workspace=apps/api
  if [[ -n "${SITEBRIEF_WEB_HOST:-}" ]]; then
    start_process 'web dashboard' "$WEB_PID_FILE" "$WEB_LOG_FILE" npm run dev --workspace=apps/web -- --host "$SITEBRIEF_WEB_HOST"
  else
    start_process 'web dashboard' "$WEB_PID_FILE" "$WEB_LOG_FILE" npm run dev --workspace=apps/web
  fi

  say 'Frontend: http://localhost:5173'
  say 'API: http://localhost:3001'
  warn_for_optional_env
}

stop_apps() {
  stop_process 'web dashboard' "$WEB_PID_FILE"
  stop_process 'API' "$API_PID_FILE"
}

install_command() {
  require_commands bash node npm
  require_docker_compose
  ensure_state_dir
  ensure_env_file
  install_dependencies
  load_api_env
  start_infra
  prepare_database
  start_apps
}

start_command() {
  require_commands bash node npm
  require_docker_compose
  ensure_state_dir
  ensure_env_file
  ensure_dependencies
  load_api_env
  start_infra
  prepare_database
  start_apps
}

stop_command() {
  ensure_state_dir
  stop_apps
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    say 'Stopping PostgreSQL and Redis'
    docker_compose down
  else
    warn 'Docker Compose is not available, so PostgreSQL and Redis were not stopped by this command.'
  fi
}

restart_command() {
  stop_command
  start_command
}

update_command() {
  require_commands bash git node npm
  require_docker_compose

  local branch_name
  if [[ -n "${SITEBRIEF_BRANCH:-}" ]]; then
    branch_name="$SITEBRIEF_BRANCH"
  else
    branch_name="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)" || fail 'Unable to detect the current git branch for update'
  fi
  [[ "$branch_name" != 'HEAD' ]] || fail 'Cannot update from a detached HEAD checkout'

  stop_apps
  say "Updating checkout from origin/$branch_name"
  run_in_project git fetch --prune origin
  run_in_project git pull --ff-only origin "$branch_name"
  install_command
}

status_command() {
  ensure_state_dir

  if is_pid_running "$API_PID_FILE"; then
    say "API: running (pid $(cat "$API_PID_FILE"))"
  else
    say 'API: stopped'
  fi

  if is_pid_running "$WEB_PID_FILE"; then
    say "web dashboard: running (pid $(cat "$WEB_PID_FILE"))"
  else
    say 'web dashboard: stopped'
  fi

  if command_exists docker && docker compose version >/dev/null 2>&1; then
    docker_compose ps || true
  else
    warn 'Docker Compose is not available, so container status could not be checked.'
  fi

  say "Logs: $STATE_DIR"
}

main() {
  local command="${1:-help}"

  case "$command" in
    install)
      install_command
      ;;
    start)
      start_command
      ;;
    stop)
      stop_command
      ;;
    restart)
      restart_command
      ;;
    update)
      update_command
      ;;
    status)
      status_command
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      usage
      fail "Unsupported command: $command"
      ;;
  esac
}

main "$@"
