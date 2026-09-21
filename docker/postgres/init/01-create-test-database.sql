-- Local development only.
-- Create the dedicated test database alongside the development database.
-- Runs on first PostgreSQL initialization (empty data volume). For existing
-- volumes, use `pnpm db:test:create` instead.
CREATE DATABASE aitvaras_test;
