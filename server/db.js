const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// 生产环境请通过环境变量 DATABASE_URL 注入真实连接串（见 deploy/miffy-backend.service）
const connectionString = process.env.DATABASE_URL ||
  'postgres://miffy:CHANGE_ME@127.0.0.1:5432/miffy';
const pool = new Pool({ connectionString, max: 10 });

// 将 SQLite 风格占位符 ? 转换为 PostgreSQL $1,$2,...
function convert(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
  const res = await pool.query(convert(sql), params);
  return res.rows;
}
async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0];
}
async function all(sql, params = []) {
  return await query(sql, params);
}
// run: INSERT 自动追加 RETURNING id；返回 { lastInsertRowid, changes }
async function run(sql, params = []) {
  let pgSql = convert(sql);
  const upper = pgSql.trim().toUpperCase();
  let returning = false;
  if (upper.startsWith('INSERT') && !/\bRETURNING\b/i.test(pgSql)) {
    pgSql += ' RETURNING id';
    returning = true;
  }
  const res = await pool.query(pgSql, params);
  if (returning && res.rows[0]) return { lastInsertRowid: res.rows[0].id, changes: res.rowCount };
  return { lastInsertRowid: undefined, changes: res.rowCount };
}

// 事务：在专用 client 上执行 BEGIN/COMMIT/ROLLBACK
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ctx = {
      get: async (sql, params = []) => {
        const r = await client.query(convert(sql), params);
        return r.rows[0];
      },
      all: async (sql, params = []) => {
        const r = await client.query(convert(sql), params);
        return r.rows;
      },
      run: async (sql, params = []) => {
        let pgSql = convert(sql);
        const upper = pgSql.trim().toUpperCase();
        let returning = false;
        if (upper.startsWith('INSERT') && !/\bRETURNING\b/i.test(pgSql)) {
          pgSql += ' RETURNING id';
          returning = true;
        }
        const r = await client.query(pgSql, params);
        if (returning && r.rows[0]) return { lastInsertRowid: r.rows[0].id, changes: r.rowCount };
        return { lastInsertRowid: undefined, changes: r.rowCount };
      }
    };
    const result = await fn(ctx);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ==================== 建表 ====================
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      icon TEXT DEFAULT '📌',
      sort_order INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fund_modules (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '🐰',
      budget_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      spent_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      period_type TEXT NOT NULL DEFAULT 'none' CHECK(period_type IN ('none', 'weekly', 'monthly')),
      default_category_id INTEGER,
      remark TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      amount DOUBLE PRECISION NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      fund_module_id INTEGER REFERENCES fund_modules(id),
      date TEXT NOT NULL,
      remark TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bills_user_date ON bills(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_bills_user_type ON bills(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_bills_fund_module ON bills(fund_module_id);
    CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_fund_modules_user ON fund_modules(user_id);

    -- 周期重置：记录模块上次清零的周期键（'YYYY-MM' / 'YYYY-Www'），NULL 表示不限周期
    ALTER TABLE fund_modules ADD COLUMN IF NOT EXISTS last_reset_period TEXT;
  `);
}

// ==================== 默认分类数据 ====================
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '餐饮类', icon: '🍽️', children: ['早餐', '午餐', '晚餐', '打牙祭', '外卖', '买菜', '饮料', '咖啡奶茶', '零食费'] },
  { name: '交通类', icon: '🚗', children: ['公交地铁', '打车', '加油', '停车费', '高铁火车', '飞机', '车辆保养'] },
  { name: '居住类', icon: '🏠', children: ['房租', '水费', '电费', '家具家电', '房屋维修'] },
  { name: '日常生活类', icon: '🛒', children: ['日用品', '服饰鞋包', '美妆护肤', '理发护理', '快递费', '手机话费', '医疗健康'] },
  { name: '娱乐与自我提升类', icon: '🎮', children: ['取悦小物', '电影娱乐', '游戏', '旅行', '聚会', '运动健身', '学习课程', '图书资料'] },
  { name: '人情与其他类', icon: '🎁', children: ['红包礼金', '请客吃饭', '宠物', '家庭支出', '临时支出', '其他支出'] }
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: '收入类', icon: '💰', children: ['工资', '奖金', '兼职收入', '红包', '返现', '理财收益', '利息', '二手交易', '退款', '家人转账', '其他收入'] }
];

const EXPENSE_ICON_MAP = {
  '早餐': '🌅', '午餐': '☀️', '晚餐': '🌙', '打牙祭': '🍖', '外卖': '🥡', '买菜': '🥬', '饮料': '🧃', '咖啡奶茶': '☕', '零食费': '🍪',
  '公交地铁': '🚇', '打车': '🚕', '加油': '⛽', '停车费': '🅿️', '高铁火车': '🚄', '飞机': '✈️', '车辆保养': '🔧',
  '房租': '🏡', '水费': '💧', '电费': '⚡', '家具家电': '🪑', '房屋维修': '🛠️',
  '日用品': '🧴', '服饰鞋包': '👗', '美妆护肤': '💄', '理发护理': '💇', '快递费': '📦', '手机话费': '📱', '医疗健康': '🏥',
  '取悦小物': '🌸', '电影娱乐': '🎬', '游戏': '🎮', '旅行': '✈️', '聚会': '🥳', '运动健身': '🏃', '学习课程': '📚', '图书资料': '📖',
  '红包礼金': '🧧', '请客吃饭': '🍽️', '宠物': '🐾', '家庭支出': '👨‍👩‍👧', '临时支出': '📋', '其他支出': '📌'
};

const INCOME_ICON_MAP = {
  '工资': '💼', '奖金': '🏆', '兼职收入': '💻', '红包': '🧧', '返现': '💵', '理财收益': '📈', '利息': '🏦', '二手交易': '🔄', '退款': '↩️', '家人转账': '👨‍👩‍👧', '其他收入': '📌'
};

// 注册后初始化默认分类
async function seedCategories(userId) {
  await transaction(async (t) => {
    const insertCat = (user_id, name, type, parent_id, icon, sort_order, is_default) =>
      t.run(
        'INSERT INTO categories (user_id, name, type, parent_id, icon, sort_order, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, name, type, parent_id, icon, sort_order, is_default]
      );

    let expenseSort = 0;
    for (const group of DEFAULT_EXPENSE_CATEGORIES) {
      const groupId = (await insertCat(userId, group.name, 'expense', null, group.icon, expenseSort, 1)).lastInsertRowid;
      expenseSort++;
      let childSort = 0;
      for (const child of group.children) {
        await insertCat(userId, child, 'expense', groupId, EXPENSE_ICON_MAP[child] || '📌', childSort, 0);
        childSort++;
      }
    }

    let incomeSort = 0;
    for (const group of DEFAULT_INCOME_CATEGORIES) {
      const groupId = (await insertCat(userId, group.name, 'income', null, group.icon, incomeSort, 1)).lastInsertRowid;
      incomeSort++;
      let childSort = 0;
      for (const child of group.children) {
        await insertCat(userId, child, 'income', groupId, INCOME_ICON_MAP[child] || '📌', childSort, 0);
        childSort++;
      }
    }
  });
}

// ==================== 辅助查询函数 ====================
async function getUserById(id) {
  return await get('SELECT id, username, created_at FROM users WHERE id = ?', [id]);
}

async function createUser(username, password) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
  const userId = result.lastInsertRowid;
  await seedCategories(userId);
  return userId;
}

async function verifyUser(username, password) {
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, avatar: user.avatar };
}

module.exports = {
  pool,
  db: { query, get, all, run, transaction },
  initSchema,
  getUserById,
  createUser,
  verifyUser,
  seedCategories
};
