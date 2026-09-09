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
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (' +
        'version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
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
        throw new Error(`${file} failed: ${err.message}`);
      }
    }
    console.log('Migrations up to date.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('db:migrate failed:', err.message);
  process.exit(1);
});
