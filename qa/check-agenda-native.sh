#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
for tool in initdb pg_ctl psql node; do
  command -v "$tool" >/dev/null || { echo "BLOCKED: falta $tool en PATH"; exit 2; }
done
[[ $(id -u) != 0 ]] || { echo 'BLOCKED: ejecuta como usuario sin privilegios'; exit 2; }
while IFS= read -r name; do unset "$name"; done < <(compgen -e | awk '/^PG/')
work=$(mktemp -d /tmp/adphor-agenda.XXXXXX)
cleanup() {
  if [[ -f "$work/db/postmaster.pid" ]]; then
    pg_ctl -D "$work/db" -m fast -w stop || return
  fi
  rm -rf -- "$work"
}
trap cleanup EXIT
initdb -D "$work/db" -A trust -U postgres >/dev/null
start() {
  pg_ctl -D "$work/db" -l "$work/postgres.log" -o "-c listen_addresses='' -k $work" -w start
}
psql --version
start
psql -X -v ON_ERROR_STOP=1 -h "$work" -U postgres -d postgres -f agenda-journal-isolated.sql
node agenda-native-fixture.js "$work" write
pg_ctl -D "$work/db" -m fast -w stop
start
node agenda-native-fixture.js "$work" recover
