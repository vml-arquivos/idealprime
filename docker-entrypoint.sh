#!/bin/sh
set -eu
echo "[Ideal Prime] iniciando migration versionada..."
node scripts/migrate.mjs
echo "[Ideal Prime] iniciando aplicação na porta ${PORT:-4000}..."
exec node dist/index.js
