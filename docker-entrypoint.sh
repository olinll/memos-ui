#!/bin/sh
set -e

BACKEND_URL=${BACKEND_URL:-http://localhost:5230}
BACKEND_GRPC=${BACKEND_GRPC:-grpc://localhost:5230}

export BACKEND_URL
export BACKEND_GRPC

envsubst '${BACKEND_URL} ${BACKEND_GRPC}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
