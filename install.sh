#!/usr/bin/env bash
set -Eeuo pipefail

SITEBRIEF_REPO_URL="${SITEBRIEF_REPO_URL:-https://github.com/mai-space/Website-idea-crawler.git}"
SITEBRIEF_INSTALL_DIR="${SITEBRIEF_INSTALL_DIR:-$HOME/sitebrief}"
SITEBRIEF_BRANCH="${SITEBRIEF_BRANCH:-main}"
SITEBRIEF_BIN_DIR="${SITEBRIEF_BIN_DIR:-$HOME/.local/bin}"
SITEBRIEF_TOOL_NAME="${SITEBRIEF_TOOL_NAME:-sitebrief}"
SITEBRIEF_TOOL_PATH="$SITEBRIEF_BIN_DIR/$SITEBRIEF_TOOL_NAME"

say() {
  printf '[sitebrief-installer] %s\n' "$*"
}

warn() {
  printf '[sitebrief-installer] warning: %s\n' "$*" >&2
}

fail() {
  printf '[sitebrief-installer] error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
Usage: install.sh [install|start|stop|restart|update|status|help]

Environment overrides:
  SITEBRIEF_INSTALL_DIR  Install target (default: ~/sitebrief)
  SITEBRIEF_BRANCH       Branch to clone on first install (default: main)
  SITEBRIEF_BIN_DIR      Directory for the sitebrief wrapper (default: ~/.local/bin)
  SITEBRIEF_REPO_URL     Repository URL to clone (default: https://github.com/mai-space/Website-idea-crawler.git)
USAGE
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

ensure_repo_checkout() {
  require_command git

  if [[ -e "$SITEBRIEF_INSTALL_DIR" && ! -d "$SITEBRIEF_INSTALL_DIR/.git" ]]; then
    fail "Install directory exists but is not a git checkout: $SITEBRIEF_INSTALL_DIR"
  fi

  if [[ -d "$SITEBRIEF_INSTALL_DIR/.git" ]]; then
    say "Using existing checkout at $SITEBRIEF_INSTALL_DIR"
    return
  fi

  mkdir -p "$(dirname "$SITEBRIEF_INSTALL_DIR")"
  say "Cloning $SITEBRIEF_REPO_URL into $SITEBRIEF_INSTALL_DIR"
  git clone --branch "$SITEBRIEF_BRANCH" "$SITEBRIEF_REPO_URL" "$SITEBRIEF_INSTALL_DIR"
}

install_wrapper() {
  local target_script="$SITEBRIEF_INSTALL_DIR/scripts/sitebrief.sh"

  [[ -x "$target_script" ]] || fail "Missing management script at $target_script"

  mkdir -p "$SITEBRIEF_BIN_DIR"
  cat > "$SITEBRIEF_TOOL_PATH" <<WRAPPER
#!/usr/bin/env bash
exec "$target_script" "\$@"
WRAPPER
  chmod +x "$SITEBRIEF_TOOL_PATH"

  say "Installed $SITEBRIEF_TOOL_NAME wrapper at $SITEBRIEF_TOOL_PATH"
  case ":$PATH:" in
    *":$SITEBRIEF_BIN_DIR:"*) ;;
    *) warn "Add $SITEBRIEF_BIN_DIR to PATH to run '$SITEBRIEF_TOOL_NAME' directly." ;;
  esac
}

run_installed_tool() {
  local command="$1"
  if [[ $# -gt 0 ]]; then
    shift
  fi
  local target_script="$SITEBRIEF_INSTALL_DIR/scripts/sitebrief.sh"

  [[ -x "$target_script" ]] || fail "Install is incomplete. Run install first."
  "$target_script" "$command" "$@"
}

main() {
  local command="${1:-install}"
  if [[ $# -gt 0 ]]; then
    shift
  fi

  case "$command" in
    install)
      ensure_repo_checkout
      install_wrapper
      run_installed_tool install "$@"
      ;;
    start|stop|restart|update|status)
      run_installed_tool "$command" "$@"
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
