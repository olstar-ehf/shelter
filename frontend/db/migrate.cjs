#!/usr/bin/env node
/**
 * Minimal SQL migration runner (Phase 2: PostGIS persistence).
 *
 * Applies frontend/db/migrations/*.sql in lexicographic order against the
 * windbreak database and records each applied file in schema_migrations, so
 * it is safe to run on every container start and locally:
 *
 *   npm run db:migrate
 *
 * Connection: WINDBREAK_DATABASE_URL (preferred) or the standard PG*
 * variables - the same resolution as the windbreak registry service.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function connectionConfig() {
  if (process.env.WINDBREAK_DATABASE_URL) {
    return { connectionString: process.env.WINDBREAK_DATABASE_URL };
  }
  return {}; // pg picks up PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD
}

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found in', MIGRATIONS_DIR);
    return;
  }

  const client = new Client(connectionConfig());
  await client.connect();
  try {
    try {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (' +
          'version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
    } catch (err) {
      throw new Error(
        `preparing schema_migrations failed: ${err.message}${remediation(err)}`,
      );
    }
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  - ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`  applying ${file} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${file} failed: ${err.message}${remediation(err)}`);
      }
    }
    console.log('Migrations up to date.');
  } finally {
    await client.end();
  }
}

/** Actionable hints for common migration failures. */
function remediation(err) {
  if (!err || err.code !== '42501') {
    return ''; // not a privilege error
  }
  const message = String(err.message || '');
  if (message.includes('schema public')) {
    return (
      ' The DB role is not allowed to create objects in the public schema ' +
      '(PostgreSQL 15+ made it non-writable by default). Run once as a ' +
      'superuser or database owner, then retry: ' +
      'GRANT CREATE, USAGE ON SCHEMA public TO <role>; ' +
      '(use the role from WINDBREAK_DATABASE_URL)'
    );
  }
  if (message.includes('extension')) {
    return (
      ' Creating the postgis extension usually requires a superuser. ' +
      'Install it once as a superuser: CREATE EXTENSION IF NOT EXISTS postgis;'
    );
  }
  return (
    ' The DB role needs more privileges; grant it ownership of the target ' +
    'schema/database or use the database owner in WINDBREAK_DATABASE_URL.'
  );
}

main().catch((err) => {
  console.error('db:migrate failed:', err.message);
  process.exit(1);
});
