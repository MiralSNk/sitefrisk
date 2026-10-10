#!/bin/bash
set -euo pipefail

BROKER="${KAFKA_BOOTSTRAP:-kafka:9092}"
KT="/opt/kafka/bin/kafka-topics.sh --bootstrap-server $BROKER"

create_topic() {
    local name="$1"; shift
    local partitions="$1"; shift
    echo "==> $name (partitions=$partitions)"
    $KT --create --if-not-exists \
        --topic "$name" \
        --partitions "$partitions" \
        --replication-factor 1 \
        "$@"
}

# Поток событий: факты сканирования -> ml. Ключ сообщения = scan_id.
create_topic scanner.facts 3 --config retention.ms=604800000

# Поток событий: прогресс сканирования -> web. Ключ = scan_id.
create_topic scanner.scan.events 3 --config retention.ms=604800000

# Состояние сущности: пользователи -> scanner, ml. Ключ = user_id.
create_topic auth.users 3 --config cleanup.policy=compact

echo "=== Топики в кластере ==="
$KT --list