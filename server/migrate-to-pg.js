// 一次性迁移脚本：将 SQLite 数据迁移到 PostgreSQL（保留原 id，重置序列）
// 用法：SQLITE_PATH=... DATABASE_URL=... node server/migrate-to-pg.js
const path = require('path');
const Database = require('better-sqlite3');
const { pool, initSchema } = require('./db');

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'miffy.db');

async function main() {
  console.log('读取 SQLite:', SQLITE_PATH);
  const sq = new Database(SQLITE_PATH, { readonly: true });
  sq.pragma('journal_mode = WAL');

  const users = sq.prepare('SELECT * FROM users').all();
  const categories = sq.prepare('SELECT * FROM categories').all();
  const fundModules = sq.prepare('SELECT * FROM fund_modules').all();
  const bills = sq.prepare('SELECT * FROM bills').all();
  sq.close();

  console.log(`SQLite 数据: users=${users.length}, categories=${categories.length}, fund_modules=${fundModules.length}, bills=${bills.length}`);

  console.log('初始化 PG 表结构...');
  await initSchema();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 清空（按外键依赖顺序）
    await client.query('DELETE FROM bills');
    await client.query('DELETE FROM fund_modules');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM users');

    for (const u of users) {
      await client.query(
        'INSERT INTO users (id, username, password_hash, avatar, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [u.id, u.username, u.password_hash, u.avatar ?? null, u.created_at ?? null]
      );
    }
    for (const c of categories) {
      await client.query(
        `INSERT INTO categories (id, user_id, name, type, parent_id, icon, sort_order, is_hidden, is_default, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.user_id, c.name, c.type, c.parent_id ?? null, c.icon ?? '📌', c.sort_order ?? 0, c.is_hidden ?? 0, c.is_default ?? 0, c.created_at ?? null]
      );
    }
    for (const m of fundModules) {
      await client.query(
        `INSERT INTO fund_modules (id, user_id, name, icon, budget_amount, spent_amount, period_type, default_category_id, remark, sort_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.user_id, m.name, m.icon ?? '🐰', m.budget_amount ?? 0, m.spent_amount ?? 0, m.period_type ?? 'none', m.default_category_id ?? null, m.remark ?? '', m.sort_order ?? 0, m.created_at ?? null, m.updated_at ?? null]
      );
    }
    for (const b of bills) {
      await client.query(
        `INSERT INTO bills (id, user_id, type, amount, category_id, fund_module_id, date, remark, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [b.id, b.user_id, b.type, b.amount, b.category_id, b.fund_module_id ?? null, b.date, b.remark ?? '', b.created_at ?? null, b.updated_at ?? null]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 重置自增序列，避免新插入 id 冲突
  for (const tbl of ['users', 'categories', 'fund_modules', 'bills']) {
    await pool.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${tbl}), 1))`, [tbl]);
  }

  const counts = {};
  for (const tbl of ['users', 'categories', 'fund_modules', 'bills']) {
    const r = await pool.query(`SELECT COUNT(*)::int as c FROM ${tbl}`);
    counts[tbl] = r.rows[0].c;
  }
  console.log('PG 数据:', counts);

  const ok = counts.users === users.length && counts.categories === categories.length &&
    counts.fund_modules === fundModules.length && counts.bills === bills.length;
  if (!ok) throw new Error('数据条数不一致，请检查！');

  await pool.end();
  console.log('迁移完成 ✅');
}

main().catch(async (e) => {
  console.error('迁移失败 ❌', e);
  try { await pool.end(); } catch (e2) {}
  process.exit(1);
});
