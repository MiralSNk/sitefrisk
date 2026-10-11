##@ Инфраструктура

.PHONY: up build down stop ps logs clean

up: ## Поднять всё (миграции и топики применятся сами)
	docker compose up -d

build: ## Пересобрать образы и поднять
	docker compose up -d --build

down: ## Остановить и удалить контейнеры (тома остаются)
	docker compose down

stop: ## Только остановить, не удаляя контейнеры
	docker compose stop

ps: ## Статус контейнеров, включая завершённые
	docker compose ps -a

logs: ## Живой хвост логов: make logs [S=scanner]
	docker compose logs -f --tail=100 $(S)

clean: ## ОПАСНО: удалить контейнеры вместе с томами
	read -p "Удалить ВСЕ данные? [y/N] " a; [ "$$a" = y ] && docker compose down -v