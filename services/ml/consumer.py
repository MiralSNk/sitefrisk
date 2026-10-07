import json
import logging
import signal
from confluent_kafka import Consumer, KafkaException, KafkaError

log = logging.getLogger(__name__)

conf = {
    "bootstrap.servers": "kafka:9092",
    "group.id": "ml-group",

    # с какого места читать, если у группы если еще нет сохранённого оффсета
    "auto.offset.reset": "earliest",

    # Для того чтобы коммитить вручную, после успешной обработки
    "enable.auto.commit": False,

    # сколько можно обрабатывать одну пачку, не зовя poll(), до того
    # как группа решит, что мы зависли, и заберёт партиции
    "max.poll.interval.ms": 300000,   # 5 минут

    # через сколько без heartbeat считать консьюмер мёртвым
    "session.timeout.ms": 45000,
}

consumer = Consumer(conf)
consumer.subscribe(["scanner.facts"])

running = True
def shutdown(*_):
    global running
    running = False

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

try:
    while running:
        msg = consumer.poll(timeout=1.0)

        if msg is None:          # за секунду ничего не пришло — вроде как норма
            continue

        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            raise KafkaException(msg.error())

        scan_id = msg.key().decode() if msg.key() else None
        fact = json.loads(msg.value())

        headers = dict(msg.headers() or [])
        event_type = headers.get("event-type", b"").decode()

        log.info(
            "fact p=%s o=%s scan=%s type=%s",
            msg.partition(), msg.offset(), scan_id, event_type,
        )

        process_fact(scan_id, fact) #TODO: реализовать логику

        # коммит после успешной обработки (дай бог она вообще установится)
        consumer.commit(msg, asynchronous=False)

finally:
    consumer.close()   # корректный выход из группы → быстрый ребаланс