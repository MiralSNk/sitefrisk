##@ Базы данных и Kafka

.PHONY: migrate migrate-status migrate-create migrate-down psql topics topics-list

MIGRATE_IMAGE := migrate/migrate:v4.20.1

migrate: ## Доприменить недостающие миграции во всех базах
	for svc in $(SERVICES); do \
	  echo "--- $$svc"; \
	  docker compose run --rm $$svc-migrate; \
	done

migrate-status: ## Версия схемы каждой базы и есть ли непримененные
	bash scripts/migrate-status.sh

migrate-create: ## Создать миграцию: make migrate-create S=scanner N=add_foo
	$(call need,S)
	$(call need,N)
	docker run --rm -v "$(PWD)/services/$(S)/migrations:/migrations" \
	  $(MIGRATE_IMAGE) create -ext sql -dir /migrations -seq -digits 6 $(N)

migrate-down: ## Откатить одну миграцию: make migrate-down S=scanner
	$(call need,S)
	docker compose run --rm --entrypoint /bin/sh $(S)-migrate \
	  -c 'migrate -path=/migrations -database "$$MIGRATE_DATABASE_URL" down 1'

psql: ## Войти в psql: make psql S=scanner
	$(call need,S)
	docker compose exec -it $(S)-db psql -U $(S) -d $(S)

topics: ## Создать/проверить топики Kafka
	docker compose run --rm kafka-init

topics-list: ## Показать топики и их настройки
	docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
	  --bootstrap-server localhost:9092 --describe