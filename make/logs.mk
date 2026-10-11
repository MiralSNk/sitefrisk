##@ Логи

.PHONY: logs-json trace errors find traces slow top

logs-json: ## Логи в едином виде [SINCE=5m]
	$(LOGS)

errors: ## Только warn и error
	$(LOGS) | jq -c 'select(.level=="warn" or .level=="error") | {ts,service,msg,err,path,status,trace_id,user_id,scan_id}'

trace: ## Весь путь запроса: make trace T=<trace_id или traceparent>
	$(call need,T)
	id=$$(echo "$(T)" | tr -d '\r' | awk -F- '{print (NF==4 ? $$2 : $$1)}'); \
	echo "trace_id=$$id" >&2; \
	$(LOGS) | jq -c --arg id "$$id" 'select(.trace_id==$$id)'

find: ## Строки по полю: make find F=user_id V=<значение>
	$(call need,F)
	$(call need,V)
	$(LOGS) | jq -c --arg f "$(F)" --arg v "$(V)" 'select((.[$$f] | tostring) == $$v)'

traces: ## Уникальные trace_id по полю: make traces F=user_id V=<значение>
	$(call need,F)
	$(call need,V)
	$(LOGS) | jq -r --arg f "$(F)" --arg v "$(V)" 'select((.[$$f] | tostring) == $$v) | .trace_id' | sort -u

slow: ## Медленнее MS миллисекунд: make slow MS=500
	$(LOGS) | jq -c --argjson ms $(or $(MS),500) 'select((.duration_ms // 0) > $$ms) | {ts,service,msg,path,duration_ms,trace_id}'

top: ## Сводка: строк и трасс на каждое сообщение
	$(LOGS) | jq -s -c 'group_by(.msg) | map({msg: .[0].msg, lines: length, traces: ([.[].trace_id] | unique | length)}) | sort_by(-.lines) | .[]'