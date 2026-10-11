# Приводит разные формы к контракту sitefrisk, СОХРАНЯЯ все остальные поля.
# Понимает наш плоский формат и ECS (вложенный и плоско-точечный).
# Не-JSON строки (баннер Spring, вывод npm) молча отбрасываются.
fromjson? // empty
| . as $raw
| {
    ts:      (.ts // ."@timestamp"),
    level:   ((.level // ."log.level" // (.log.level?) // "") | ascii_downcase),
    service: (if (.service | type) == "object" then .service.name
              else (.service // ."service.name") end),
    msg:     (.msg // .message)
  }
  + ($raw | del(.ts, ."@timestamp", .level, ."log.level", .log,
                .service, ."service.name", .msg, .message))