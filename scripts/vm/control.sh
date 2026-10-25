#!/bin/sh
set -eu

action=$1
project=$2
release=$(pwd)

compose() {
    docker compose -p "$project" --project-directory "$release" -f scripts/vm/compose.yml "$@"
}

if [ "$action" != start ]; then
    echo "Unsupported action: $action" >&2
    exit 1
fi

# Build before stopping the old application. Keep existing database/storage volumes.
export COMPOSE_PARALLEL_LIMIT=1
compose build app
compose stop app
compose up -d --wait --wait-timeout 360
compose ps
