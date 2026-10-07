FROM apache/kafka:4.1.1

USER root

RUN mkdir -p /var/lib/kafka/data && chown -R appuser:appuser /var/lib/kafka/data

USER appuser