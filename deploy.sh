#!/bin/bash
# =============================================================================
# OpenClaw Avatar - Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh              # Full deployment
#   ./deploy.sh build        # Build only
#   ./deploy.sh push         # Push to server only
#   ./deploy.sh status       # Check status
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
SERVER_IP="${DEPLOY_SERVER:-35.193.74.48}"
SERVER_USER="${DEPLOY_USER:-cengqianwei}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/id_rsa}"
REMOTE_PATH="${DEPLOY_PATH:-/home/$SERVER_USER/App/openclaw-avatar}"
IMAGE_NAME="sngxai/openclaw-avatar"
TAG="${VERSION:-latest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

ssh_cmd() { ssh -i "$SSH_KEY" -o ConnectTimeout=15 "$SERVER_USER@$SERVER_IP" "$@"; }
scp_cmd() { scp -i "$SSH_KEY" -o ConnectTimeout=15 "$@"; }

do_build() {
    log_info "Building openclaw-avatar..."
    docker build \
        -f docker/Dockerfile \
        -t "$IMAGE_NAME:$TAG" \
        .
    log_success "Image built: $IMAGE_NAME:$TAG"
}

do_push() {
    log_info "Pushing to server..."

    ssh_cmd "mkdir -p $REMOTE_PATH"

    local tar_file
    tar_file=$(mktemp /tmp/avatar-XXXXXX.tar)
    docker save -o "$tar_file" "$IMAGE_NAME:$TAG"

    scp_cmd "$tar_file" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/avatar.tar"
    scp_cmd docker/docker-compose.yml "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/"
    rm -f "$tar_file"

    ssh_cmd bash -s "$REMOTE_PATH" << 'EOF'
        set -e
        cd "$1"
        docker load -i avatar.tar
        rm -f avatar.tar
        docker compose down 2>/dev/null || true
        docker compose up -d
        sleep 5
        docker compose ps
        echo "Avatar deployment complete"
EOF
    log_success "Avatar deployed"
}

do_status() {
    ssh_cmd "cd $REMOTE_PATH && docker compose ps"
}

case "${1:-}" in
    build)  do_build ;;
    push)   do_push ;;
    status) do_status ;;
    *)      do_build && do_push ;;
esac
