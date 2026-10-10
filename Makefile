SHELL    := /bin/bash
SERVICES := scanner auth ml

.SILENT:

.DEFAULT_GOAL := help
.PHONY: help up build down stop ps logs migrate migrate-status migrate-create migrate-down topics topics-list psql clean

help: ## Показать список команд
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
	 | awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Поднять всё (миграции и топики применятся сами)
	docker compose up -d

build: ## Пересобрать образы и поднять
	docker compose up -d --build

down: ## Остановить и удалить контейнеры (тома остаются)
	docker compose down

stop: ## Только остановить
	docker compose stop

ps: ## Статус контейнеров
	docker compose ps

logs: ## Логи; make logs S=scanner — одного сервиса
	docker compose logs -f --tail=100 $(S)

migrate: ## Доприменить недостающие миграции во всех базах
	@for svc in $(SERVICES); do \
	  echo "--- $$svc"; \
	  docker compose run --rm $$svc-migrate; \
	done

migrate-status: ## Версия схемы каждой базы и есть ли непримененные
	@bash scripts/migrate-status.sh

migrate-create: ## Создать миграцию: make migrate-create S=scanner N=add_foo
	@test -n "$(S)" || { echo "укажи S=scanner|auth|ml"; exit 1; }
	@test -n "$(N)" || { echo "укажи N=имя_миграции"; exit 1; }
	docker run --rm -v "$(PWD)/services/$(S)/migrations:/migrations" \
	  migrate/migrate:v4.20.1 create -ext sql -dir /migrations -seq -digits 6 $(N)

migrate-down: ## Откатить одну миграцию: make migrate-down S=scanner
	@test -n "$(S)" || { echo "укажи S=scanner|auth|ml"; exit 1; }
	docker compose run --rm --entrypoint /bin/sh $(S)-migrate \
	  -c 'migrate -path=/migrations -database "$$DATABASE_URL" down 1'

topics: ## Создать/проверить топики Kafka
	docker compose run --rm kafka-init

topics-list: ## Показать топики и их настройки
	docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
	  --bootstrap-server localhost:9092 --describe

psql: ## Войти в psql: make psql S=scanner
	@test -n "$(S)" || { echo "укажи S=scanner|auth|ml"; exit 1; }
	docker compose exec -it $(S)-db psql -U $(S) -d $(S)

clean: ## ОПАСНО: удалить контейнеры вместе с томами
	@read -p "Удалить ВСЕ данные? [y/N] " a; [ "$$a" = y ] && docker compose down -v