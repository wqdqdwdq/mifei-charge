'use strict';

// 周期重置工具：让 period_type 为 monthly / weekly 的资金模块在跨周期时
// 自动清空"已用金额(spent_amount)"，而预算金额(budget_amount)保持不变，
// 即"保留模块、继承上月设置的金额"。period_type 为 none 的模块不维护 spent。

// 当前周期键：monthly -> 'YYYY-MM'，weekly -> 'YYYY-Www'，none -> null
function currentPeriodKey(periodType) {
  const d = new Date();
  if (periodType === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (periodType === 'weekly') {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return null;
}

// 某日期字符串所属周期键（与 currentPeriodKey 同口径），用于判断一笔账单是否属于"当前周期"
function periodKeyOfDate(dateStr, periodType) {
  if (!dateStr) return null;
  if (periodType === 'monthly') {
    return String(dateStr).slice(0, 7); // 'YYYY-MM-DD' -> 'YYYY-MM'
  }
  if (periodType === 'weekly') {
    const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return null;
}

// 跨周期时把 spent_amount 重算为"当前周期账单之和"并写入 last_reset_period；
// 同周期内（last_reset_period 已是当前键）直接返回，避免每个请求都重算。
// db 需提供 get / all / run 接口（与 server/db.js 的 db 对象兼容）。
async function resetModuleSpent(db, module) {
  const key = currentPeriodKey(module.period_type);
  if (!key) return module;                              // none：不维护 spent
  if (module.last_reset_period === key) return module;  // 已在当前周期

  const rows = await db.all(
    'SELECT date, amount FROM bills WHERE fund_module_id = ? AND type = ?',
    [module.id, 'expense']
  );
  let sum = 0;
  for (const r of rows) {
    if (periodKeyOfDate(r.date, module.period_type) === key) {
      sum += Number(r.amount) || 0;
    }
  }
  await db.run(
    'UPDATE fund_modules SET spent_amount = ?, last_reset_period = ? WHERE id = ?',
    [sum, key, module.id]
  );
  module.spent_amount = sum;
  module.last_reset_period = key;
  return module;
}

// 判断某笔账单是否属于模块的"当前周期"（只有当前周期的账单才影响 spent）
function isBillInCurrentPeriod(dateStr, periodType) {
  if (periodType === 'none') return true; // 不限周期：始终累计
  return periodKeyOfDate(dateStr, periodType) === currentPeriodKey(periodType);
}

module.exports = { currentPeriodKey, periodKeyOfDate, resetModuleSpent, isBillInCurrentPeriod };
