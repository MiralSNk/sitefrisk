#!/bin/bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}';

    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_USER};

    -- USAGE без CREATE: видеть схему, но не создавать объекты
    GRANT USAGE ON SCHEMA public TO ${APP_USER};

    -- На уже существующие объекты
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_USER};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER};

    -- На объекты, которые владелец создаст в будущих миграциях
    ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
    ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};
SQL