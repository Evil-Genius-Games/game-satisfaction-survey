const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const migrationFiles = [
  'create_coupon_codes.sql',
  'add_coupon_tracking_columns.sql',
  'create_gm_adventures.sql',
  'create_gm_conventions.sql',
  'run_all_coupon_migrations.sql',
  '20260606_harden_schema.sql',
  '20260606_restore_three_rating_sequence.sql',
  '20260607_restore_open_ended_question.sql',
  '20260607_move_open_ended_to_third.sql',
  '20260608_admin_accounts.sql',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to apply migrations.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    for (const fileName of migrationFiles) {
      const filePath = path.join(process.cwd(), 'migrations', fileName);
      const sql = fs.readFileSync(filePath, 'utf8').trim();
      if (!sql) continue;
      console.log(`Applying ${fileName}...`);
      await pool.query(sql);
      console.log(`Applied ${fileName}`);
    }

    const checks = await pool.query(`
      SELECT
        to_regclass('public.admin_users') AS admin_users_table,
        to_regclass('public.coupon_codes') AS coupon_codes_table,
        to_regclass('public.gm_adventures') AS gm_adventures_table,
        to_regclass('public.gm_conventions') AS gm_conventions_table
    `);
    console.log('Schema check:', JSON.stringify(checks.rows[0]));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
