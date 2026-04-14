-- Ejecutar esto como usuario "postgres" (superadmin) en DBeaver
-- contra la base de datos "vps_apps_db"

-- 1. Crear el schema "prode"
CREATE SCHEMA IF NOT EXISTS prode;

-- 2. Dar permisos al usuario limitado
GRANT USAGE ON SCHEMA prode TO app_user;
GRANT CREATE ON SCHEMA prode TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA prode GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA prode GRANT ALL ON SEQUENCES TO app_user;

-- Verificar que se creó
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'prode';
