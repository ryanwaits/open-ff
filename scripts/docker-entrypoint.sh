#!/bin/sh
set -eu

# Compose / image set OPENFF_SELF_TICK + PGLITE_DATA_DIR. Fill a session
# secret when the operator left BETTER_AUTH_SECRET blank in .env.
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  BETTER_AUTH_SECRET="$(openssl rand -hex 32 2>/dev/null || bun -e 'process.stdout.write(crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),""))')"
  export BETTER_AUTH_SECRET
  echo "BETTER_AUTH_SECRET was unset; generated one for this process"
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "WARN: CRON_SECRET unset — /api/league/tick is public (in-process tick still runs)"
fi

mkdir -p "${PGLITE_DATA_DIR:-/data/pglite}"

exec bun run dev
