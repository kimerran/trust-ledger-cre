#!/usr/bin/env tsx
/**
 * db-reset.ts — Drops all tables, re-runs migrations, and re-seeds demo data.
 * Run with: pnpm --filter api db:reset
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationsDir = resolve(__dirname, '../apps/api/db/migrations');

async function main() {
  console.log('TrustLedger Database Reset\n');

  // 1. Drop all tables and custom types
  console.log('-> Dropping all tables and types...');
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('   Done.');

  // 2. Apply migration SQL files directly
  console.log('-> Running migrations...');
  const sqlFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf-8');
    // drizzle uses "--> statement-breakpoint" to split statements
    const statements = sql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) await pool.query(trimmed);
    }
    console.log(`   Applied ${file}`);
  }

  // 3. Re-seed demo data
  console.log('-> Seeding demo data...');
  // Import seed which runs its own main()
  await import('./seed-demo');

  await pool.end();
}

main().catch(async (err) => {
  console.error('Reset failed:', err);
  await pool.end();
  process.exit(1);
});
