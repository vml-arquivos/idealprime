#!/bin/sh
set -eu
echo "[Ideal Prime] iniciando migration versionada..."
node scripts/migrate.mjs

if [ "${SEED_CATALOG_MASTER_ON_STARTUP:-false}" = "true" ]; then
  echo "[Ideal Prime] aplicando Catálogo Mestre idempotente..."
  node scripts/seed-catalog-master.mjs
else
  echo "[Ideal Prime] seed automático desativado (SEED_CATALOG_MASTER_ON_STARTUP=false)."
fi

echo "[Ideal Prime] iniciando aplicação na porta ${PORT:-4000}..."
exec node dist/index.js
