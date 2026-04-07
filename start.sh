#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PIDFILE="$SCRIPT_DIR/.defensewatch.pid"
APP_NAME="DefenseWatch"

# ── Helpers ──────────────────────────────────────────────────────────

# Find the uvicorn process by command signature (fallback when no pidfile)
find_process() {
    pgrep -f "uvicorn defensewatch\.main:app" 2>/dev/null || true
}

get_pid() {
    # Try pidfile first
    if [ -f "$PIDFILE" ]; then
        local pid
        pid=$(cat "$PIDFILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return 0
        fi
        rm -f "$PIDFILE"
    fi
    # Fall back to process search
    find_process
}

is_running() {
    [ -n "$(get_pid)" ]
}

read_config() {
    HOST=$(venv/bin/python3 -c "
import yaml
with open('config.yaml') as f:
    c = yaml.safe_load(f)
print(c.get('server', {}).get('host', '127.0.0.1'))
" 2>/dev/null || echo "127.0.0.1")

    PORT=$(venv/bin/python3 -c "
import yaml
with open('config.yaml') as f:
    c = yaml.safe_load(f)
print(c.get('server', {}).get('port', 9000))
" 2>/dev/null || echo "9000")
}

# ── Commands ─────────────────────────────────────────────────────────

do_start() {
    local existing_pid
    existing_pid=$(get_pid)
    if [ -n "$existing_pid" ]; then
        echo "$APP_NAME is already running (PID $existing_pid)."
        exit 0
    fi

    # Validate prerequisites
    if [ ! -d "venv" ]; then
        echo "ERROR: Virtual environment not found. Run ./setup.sh first."
        exit 1
    fi

    if [ ! -f "config.yaml" ]; then
        echo "ERROR: config.yaml not found. Run ./setup.sh first."
        exit 1
    fi

    if [ ! -f ".env" ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "WARNING: .env file not found"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "$APP_NAME will start, but enhanced features will be unavailable:"
        echo "  - IP enrichment (Shodan, VirusTotal, Censys)"
        echo "  - Threat intelligence (AbuseIPDB, OTX)"
        echo "  - Telegram notifications"
        echo "  - Webhook alerts"
        echo ""
        echo "To enable these features:"
        echo "  1. cp .env.example .env"
        echo "  2. Edit .env and add your API keys"
        echo "  3. Restart $APP_NAME"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        sleep 3
    fi

    read_config

    echo "Starting $APP_NAME on ${HOST}:${PORT}..."
    venv/bin/uvicorn defensewatch.main:app \
        --host "$HOST" \
        --port "$PORT" \
        --log-level info &
    echo $! > "$PIDFILE"
    echo "$APP_NAME started (PID $(cat "$PIDFILE"))."
}

do_stop() {
    local pid
    pid=$(get_pid)
    if [ -z "$pid" ]; then
        echo "$APP_NAME is not running."
        rm -f "$PIDFILE"
        return 0
    fi

    echo "Stopping $APP_NAME (PID $pid)..."
    kill "$pid"

    # Wait up to 10 seconds for graceful shutdown
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        if [ $i -ge 10 ]; then
            echo "Graceful shutdown timed out, forcing..."
            kill -9 "$pid" 2>/dev/null || true
            break
        fi
        sleep 1
        i=$((i + 1))
    done

    rm -f "$PIDFILE"
    echo "$APP_NAME stopped."
}

do_restart() {
    do_stop
    do_start
}

do_status() {
    local pid
    pid=$(get_pid)
    if [ -n "$pid" ]; then
        echo "$APP_NAME is running (PID $pid)."
    else
        echo "$APP_NAME is not running."
        rm -f "$PIDFILE"
    fi
}

# ── Main ─────────────────────────────────────────────────────────────

case "${1:-start}" in
    start)   do_start   ;;
    stop)    do_stop    ;;
    restart) do_restart ;;
    status)  do_status  ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
