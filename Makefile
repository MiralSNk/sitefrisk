SHELL    := /bin/bash
SERVICES := scanner auth ml

.SILENT:
.DEFAULT_GOAL := help

# ---- Общие настройки -------------------------------------------------
# ?= означает "если не задано снаружи". make errors SINCE=5m переопределит.
SINCE ?= 30m

# Источник логов отделён от конвейера, чтобы фильтры можно было прогонять
# на сохранённом файле: make errors LOG_SOURCE="cat saved.log"
LOG_SOURCE ?= docker compose logs --no-log-prefix --since $(SINCE)
LOGS        = $(LOG_SOURCE) | jq -Rc -f scripts/logs.jq

# need — проверка обязательного аргумента. В рецепте: $(call need,S)
# ВАЖНО: вызов должен стоять на строке с табом, иначе make решит, что это
# makefile-строка, и упадёт с "missing separator".
define need
@test -n "$($(1))" || { echo "нужен аргумент $(1)=<значение>"; exit 1; }
endef

include make/infra.mk
include make/db.mk
include make/logs.mk

# ---- Справка ---------------------------------------------------------
help: ## Показать список команд
	awk 'BEGIN { FS = ":.*?## " } \
	  /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next } \
	  /^[a-z][a-z0-9-]*:.*?## / { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' \
	  $(MAKEFILE_LIST)