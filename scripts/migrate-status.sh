#!/usr/bin/env bash
# Сравнивает версию схемы в каждой базе с последней миграцией на диске.
set -uo pipefail

SERVICES=(scanner auth ml)
rc=0

printf '%-10s %-9s %-9s %-7s %s\n' СЕРВИС В_БАЗЕ НА_ДИСКЕ DIRTY СТАТУС
printf '%-10s %-9s %-9s %-7s %s\n' ---------- --------- --------- ------- ------

for svc in "${SERVICES[@]}"; do
    disk_raw=$(ls "services/$svc/migrations"/*.up.sql 2>/dev/null \
               | xargs -r -n1 basename | cut -d_ -f1 | sort -n | tail -1)
    disk=$((10#${disk_raw:-0}))

    row=$(docker compose exec -T "$svc-db" psql -U "$svc" -d "$svc" -tAc \
            "SELECT version || '|' || dirty FROM schema_migrations" 2>/dev/null) || row=""

    if [[ -z "$row" ]]; then
        db=0; dirty="-"
    else
        db=${row%%|*}; dirty=${row##*|}
    fi

    if [[ "$dirty" == "t" || "$dirty" == "true" ]]; then
        status="DIRTY — нужен force"; rc=1
    elif (( db < disk )); then
        status="отстаёт на $((disk - db)) — нужен make migrate"; rc=1
    elif (( db > disk )); then
        status="в базе версия выше, чем файлов на диске"; rc=1
    else
        status="OK"
    fi

    printf '%-10s %-9s %-9s %-7s %s\n' "$svc" "$db" "$disk" "$dirty" "$status"
done

exit $rc