const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../auth');

// 月度概览
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    // 上月（用于对比）
    let lastMonth = month - 1;
    let lastYear = year;
    if (lastMonth === 0) { lastMonth = 12; lastYear--; }
    const lastStartDate = `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`;
    const lastEndDay = new Date(lastYear, lastMonth, 0).getDate();
    const lastEndDate = `${lastYear}-${String(lastMonth).padStart(2, '0')}-${String(lastEndDay).padStart(2, '0')}`;

    // 本月收支（区分“工资”类收入与其他收入）
    const monthStats = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN b.type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN b.type = 'income' AND c.name = '工资' THEN amount ELSE 0 END), 0) as salary_income,
        COALESCE(SUM(CASE WHEN b.type = 'income' AND (c.name IS NULL OR c.name <> '工资') THEN amount ELSE 0 END), 0) as other_income,
        COALESCE(SUM(CASE WHEN b.type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.date BETWEEN ? AND ?
    `, [userId, startDate, endDate]);

    // 上月支出
    const lastMonthExpense = await db.get(`
      SELECT COALESCE(SUM(amount), 0) as expense
      FROM bills WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
    `, [userId, lastStartDate, lastEndDate]);

    // 模块总金额（所有资金模块的预算之和）
    const moduleBudget = await db.get(`
      SELECT COALESCE(SUM(budget_amount), 0) as total
      FROM fund_modules WHERE user_id = ?
    `, [userId]);

    res.json({
      income: monthStats.income,
      salaryIncome: monthStats.salary_income,
      otherIncome: monthStats.other_income,
      expense: monthStats.expense,
      moduleBudget: moduleBudget.total,
      balance: monthStats.salary_income - monthStats.expense,
      disposable: moduleBudget.total - monthStats.expense,
      lastMonthExpense: lastMonthExpense.expense,
      compareRatio: lastMonthExpense.expense > 0
        ? Math.round(((monthStats.expense - lastMonthExpense.expense) / lastMonthExpense.expense) * 1000) / 10
        : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取月度概览失败' });
  }
});

// 每日支出趋势
router.get('/daily', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const dailyExpense = await db.all(`
      SELECT date, COALESCE(SUM(amount), 0) as total
      FROM bills WHERE user_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
      GROUP BY date ORDER BY date
    `, [userId, startDate, endDate]);

    const dailyIncome = await db.all(`
      SELECT date, COALESCE(SUM(amount), 0) as total
      FROM bills WHERE user_id = ? AND type = 'income' AND date BETWEEN ? AND ?
      GROUP BY date ORDER BY date
    `, [userId, startDate, endDate]);

    res.json({ dailyData: dailyExpense, dailyIncome, year, month });
  } catch (err) {
    res.status(500).json({ error: '获取每日趋势失败' });
  }
});

// 支出分类占比
router.get('/category-expense', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    // 按分组汇总
    const groupData = await db.all(`
      SELECT p.name as group_name, p.icon as group_icon, p.id as group_id,
             COALESCE(SUM(b.amount), 0) as total
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      JOIN categories p ON c.parent_id = p.id
      WHERE b.user_id = ? AND b.type = 'expense' AND b.date BETWEEN ? AND ?
      GROUP BY p.id, p.name, p.icon
      ORDER BY total DESC
    `, [userId, startDate, endDate]);

    // 按子分类汇总
    const categoryData = await db.all(`
      SELECT c.id, c.name, c.icon, p.name as group_name,
             COALESCE(SUM(b.amount), 0) as total, CAST(COUNT(b.id) AS INTEGER) as count
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      JOIN categories p ON c.parent_id = p.id
      WHERE b.user_id = ? AND b.type = 'expense' AND b.date BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.icon, p.id, p.name
      ORDER BY total DESC
      LIMIT 20
    `, [userId, startDate, endDate]);

    const totalExpense = categoryData.reduce((sum, c) => sum + Number(c.total), 0);

    res.json({
      groupData: groupData.map(g => ({
        ...g,
        percent: totalExpense > 0 ? Math.round((g.total / totalExpense) * 1000) / 10 : 0
      })),
      categoryData: categoryData.map(c => ({
        ...c,
        percent: totalExpense > 0 ? Math.round((c.total / totalExpense) * 1000) / 10 : 0
      })),
      totalExpense
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取分类统计失败' });
  }
});

// 收入分类占比
router.get('/category-income', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const categoryData = await db.all(`
      SELECT c.id, c.name, c.icon,
             COALESCE(SUM(b.amount), 0) as total, CAST(COUNT(b.id) AS INTEGER) as count
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.type = 'income' AND b.date BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.icon
      ORDER BY total DESC
    `, [userId, startDate, endDate]);

    const totalIncome = categoryData.reduce((sum, c) => sum + Number(c.total), 0);

    res.json({
      categoryData: categoryData.map(c => ({
        ...c,
        percent: totalIncome > 0 ? Math.round((c.total / totalIncome) * 1000) / 10 : 0
      })),
      totalIncome
    });
  } catch (err) {
    res.status(500).json({ error: '获取收入统计失败' });
  }
});

// 资金模块使用情况
router.get('/modules', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const moduleData = await db.all(`
      SELECT f.id, f.name, f.icon, f.budget_amount, f.spent_amount as total_spent,
             COALESCE(SUM(CASE WHEN b.date BETWEEN ? AND ? THEN b.amount ELSE 0 END), 0) as month_spent,
             CAST(COUNT(CASE WHEN b.date BETWEEN ? AND ? THEN b.id ELSE NULL END) AS INTEGER) as month_count
      FROM fund_modules f
      LEFT JOIN bills b ON b.fund_module_id = f.id
      WHERE f.user_id = ?
      GROUP BY f.id, f.name, f.icon, f.budget_amount, f.spent_amount
      ORDER BY f.sort_order, f.created_at
    `, [startDate, endDate, startDate, endDate, userId]);

    res.json({
      moduleData: moduleData.map(m => ({
        ...m,
        remaining: m.budget_amount - m.total_spent,
        progress: m.budget_amount > 0 ? Math.round((m.total_spent / m.budget_amount) * 1000) / 10 : 0
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取模块统计失败' });
  }
});

// 年度统计（12 个月收支汇总）
router.get('/yearly', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 按月聚合收入和支出
    const monthlyData = await db.all(`
      SELECT TO_CHAR(date::date, 'MM') as month,
             COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
             COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
             CAST(COUNT(*) AS INTEGER) as count
      FROM bills WHERE user_id = ? AND date BETWEEN ? AND ?
      GROUP BY TO_CHAR(date::date, 'MM')
      ORDER BY month
    `, [userId, startDate, endDate]);

    // 全年分类支出排行
    const topCategories = await db.all(`
      SELECT c.id, c.name, c.icon,
             COALESCE(SUM(b.amount), 0) as total, CAST(COUNT(b.id) AS INTEGER) as count
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.type = 'expense' AND b.date BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.icon
      ORDER BY total DESC
      LIMIT 10
    `, [userId, startDate, endDate]);

    // 全年分类收入排行
    const topIncomeCategories = await db.all(`
      SELECT c.id, c.name, c.icon,
             COALESCE(SUM(b.amount), 0) as total, CAST(COUNT(b.id) AS INTEGER) as count
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.type = 'income' AND b.date BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.icon
      ORDER BY total DESC
      LIMIT 10
    `, [userId, startDate, endDate]);

    // 全年汇总
    const yearlyTotal = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpense,
        CAST(COUNT(*) AS INTEGER) as totalCount
      FROM bills WHERE user_id = ? AND date BETWEEN ? AND ?
    `, [userId, startDate, endDate]);

    // 填充缺失月份为 0
    const months = {};
    monthlyData.forEach(m => { months[m.month] = m; });
    for (let m = 1; m <= 12; m++) {
      const key = String(m).padStart(2, '0');
      if (!months[key]) months[key] = { month: key, income: 0, expense: 0, count: 0 };
    }

    const totalExpense = topCategories.reduce((s, c) => s + Number(c.total), 0);
    const totalIncomeCat = topIncomeCategories.reduce((s, c) => s + Number(c.total), 0);

    res.json({
      year,
      monthlyData: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
      totalIncome: yearlyTotal.totalIncome,
      totalExpense: yearlyTotal.totalExpense,
      balance: yearlyTotal.totalIncome - yearlyTotal.totalExpense,
      totalCount: yearlyTotal.totalCount,
      topCategories: topCategories.map(c => ({
        ...c,
        percent: totalExpense > 0 ? Math.round((c.total / totalExpense) * 1000) / 10 : 0
      })),
      topIncomeCategories: topIncomeCategories.map(c => ({
        ...c,
        percent: totalIncomeCat > 0 ? Math.round((c.total / totalIncomeCat) * 1000) / 10 : 0
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取年度统计失败' });
  }
});

module.exports = router;
