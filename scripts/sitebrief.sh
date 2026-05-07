#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${SITEBRIEF_STATE_DIR:-$PROJECT_ROOT/.sitebrief}"
API_ENV_FILE="$PROJECT_ROOT/apps/api/.env"
ENV_TEMPLATE="$PROJECT_ROOT/.env.example"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
API_PID_FILE="$STATE_DIR/api.pid"
WEB_PID_FILE="$STATE_DIR/web.pid"
API_LOG_FILE="$STATE_DIR/api.log"
WEB_LOG_FILE="$STATE_DIR/web.log"
JWT_TEMPLATE_SECRET='change-me-in-production-min-32-chars'
JWT_DEV_SECRET='dev-secret-change-in-production'

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

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

get_env_value() {
  local key="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  grep -E "^${key}=" "$file" | tail -n 1 | cut -d'=' -f2- || true
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
  elif [[ -z "$current_jwt_secret" || "$current_jwt_secret" == "$JWT_TEMPLATE_SECRET" || "$current_jwt_secret" == "$JWT_DEV_SECRET" ]]; then
    upsert_env_var JWT_SECRET "$(generate_jwt_secret)" "$API_ENV_FILE"
    say 'Generated a local JWT secret in apps/api/.env'
  fi
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
  run_in_project npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
}

is_pid_running() {
  local pid_file="$1"
  local pid

  [[ -f "$pid_file" ]] || return 1
  pid="$(cat "$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || {
    rm -f "$pid_file"
    return 1
  }

  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  rm -f "$pid_file"
  return 1
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
    nohup "${command_args[@]}" >> "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  sleep 3
  if ! is_pid_running "$pid_file"; then
    tail -n 20 "$log_file" || true
    fail "$label failed to start. Check $log_file"
  fi

  say "Started $label (pid $(cat "$pid_file")); log: $log_file"
}

stop_process() {
  local label="$1"
  local pid_file="$2"
  local pid
  local attempt

  if ! is_pid_running "$pid_file"; then
    say "$label is not running"
    return 0
  fi

  pid="$(cat "$pid_file")"
  kill "$pid" 2>/dev/null || true

  for attempt in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      say "Stopped $label"
      return 0
    fi
    sleep 1
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  say "Force-stopped $label"
}

start_apps() {
  start_process 'API' "$API_PID_FILE" "$API_LOG_FILE" npm run dev --workspace=apps/api
  start_process 'web dashboard' "$WEB_PID_FILE" "$WEB_LOG_FILE" npm run dev --workspace=apps/web -- --host 0.0.0.0

  say 'Frontend: http://localhost:5173'
  say 'API: http://localhost:3001'
  warn_for_optional_env
}

stop_apps() {
  stop_process 'web dashboard' "$WEB_PID_FILE"
  stop_process 'API' "$API_PID_FILE"
}

install_command() {
  require_commands bash git node npm
  require_docker_compose
  ensure_state_dir
  ensure_env_file
  install_dependencies
  start_infra
  prepare_database
  start_apps
}

start_command() {
  require_commands bash git node npm
  require_docker_compose
  ensure_state_dir
  ensure_env_file
  ensure_dependencies
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
  branch_name="${SITEBRIEF_BRANCH:-$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)}"
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
