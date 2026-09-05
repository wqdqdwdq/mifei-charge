const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../auth');
const { resetModuleSpent, isBillInCurrentPeriod } = require('../periodUtil');

// 获取账单列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, category_id, fund_module_id, start_date, end_date, keyword, page = 1, limit = 50 } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['b.user_id = ?'];
    let params = [userId];

    if (type) { where.push('b.type = ?'); params.push(type); }
    if (category_id) { where.push('b.category_id = ?'); params.push(parseInt(category_id)); }
    if (fund_module_id) { where.push('b.fund_module_id = ?'); params.push(parseInt(fund_module_id)); }
    if (start_date) { where.push('b.date >= ?'); params.push(start_date); }
    if (end_date) { where.push('b.date <= ?'); params.push(end_date); }
    if (keyword) { where.push('(b.remark LIKE ? OR c.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }

    const whereClause = where.join(' AND ');

    const bills = await db.all(`
      SELECT b.*, c.name as category_name, c.icon as category_icon,
             f.name as fund_module_name, f.icon as fund_module_icon
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN fund_modules f ON b.fund_module_id = f.id
      WHERE ${whereClause}
      ORDER BY b.date DESC, b.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const total = await db.get(`
      SELECT CAST(COUNT(*) AS INTEGER) as count FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE ${whereClause}
    `, params);

    res.json({ bills, total: total.count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取账单列表失败' });
  }
});

// 获取单个账单
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const bill = await db.get(`
      SELECT b.*, c.name as category_name, c.icon as category_icon,
             f.name as fund_module_name, f.icon as fund_module_icon
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN fund_modules f ON b.fund_module_id = f.id
      WHERE b.id = ? AND b.user_id = ?
    `, [req.params.id, req.user.id]);

    if (!bill) return res.status(404).json({ error: '账单不存在' });
    res.json({ bill });
  } catch (err) {
    res.status(500).json({ error: '获取账单失败' });
  }
});

// 创建账单
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, amount, category_id, fund_module_id, date, remark } = req.body;
    const userId = req.user.id;

    if (!type || !amount || !category_id || !date) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: '金额必须大于0' });
    }

    if (type === 'expense' && !fund_module_id) {
      return res.status(400).json({ error: '支出需要选择资金模块' });
    }

    // 检查资金模块余额
    let lowBalance = false;
    let module = null;
    if (type === 'expense' && fund_module_id) {
      module = await db.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [fund_module_id, userId]);
      if (!module) {
        return res.status(400).json({ error: '资金模块不存在' });
      }
      // 跨周期自动清零已用金额（预算不变 = 继承上月金额）
      await resetModuleSpent(db, module);
      const remaining = module.budget_amount - module.spent_amount;
      if (remaining < amount) {
        lowBalance = true;
      }
    }

    // 使用事务：创建账单 + 扣除模块金额
    const billId = await db.transaction(async (t) => {
      const result = await t.run(`
        INSERT INTO bills (user_id, type, amount, category_id, fund_module_id, date, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, type, amount, category_id, type === 'expense' ? fund_module_id : null, date, remark || '']);

      // 仅当该笔账单属于模块当前周期时计入已用金额，避免历史账单影响本月预算
      if (type === 'expense' && fund_module_id && isBillInCurrentPeriod(date, module.period_type)) {
        await t.run(`
          UPDATE fund_modules SET spent_amount = spent_amount + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `, [amount, fund_module_id, userId]);
      }

      return result.lastInsertRowid;
    });

    const bill = await db.get(`
      SELECT b.*, c.name as category_name, c.icon as category_icon,
             f.name as fund_module_name
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN fund_modules f ON b.fund_module_id = f.id
      WHERE b.id = ?
    `, [billId]);

    res.json({ bill, lowBalance, message: lowBalance ? '该模块剩余金额不足，已继续记账' : '记账成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建账单失败' });
  }
});

// 修改账单
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const billId = parseInt(req.params.id);
    const userId = req.user.id;
    const { type, amount, category_id, fund_module_id, date, remark } = req.body;

    if (!type || !amount || !category_id || !date) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const oldBill = await db.get('SELECT * FROM bills WHERE id = ? AND user_id = ?', [billId, userId]);
    if (!oldBill) {
      return res.status(404).json({ error: '账单不存在' });
    }

    await db.transaction(async (t) => {
      // 恢复原模块金额（先跨周期对齐；仅当旧账单属于原模块当前周期才回退）
      if (oldBill.type === 'expense' && oldBill.fund_module_id) {
        const oldMod = await t.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [oldBill.fund_module_id, userId]);
        if (oldMod) {
          await resetModuleSpent(t, oldMod);
          if (isBillInCurrentPeriod(oldBill.date, oldMod.period_type)) {
            await t.run(`
              UPDATE fund_modules SET spent_amount = GREATEST(0, spent_amount - ?), updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND user_id = ?
            `, [oldBill.amount, oldBill.fund_module_id, userId]);
          }
        }
      }

      // 扣除新模块金额（先跨周期对齐；仅当新账单属于当前周期才计入）
      if (type === 'expense' && fund_module_id) {
        const newMod = await t.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [fund_module_id, userId]);
        if (newMod) {
          await resetModuleSpent(t, newMod);
          if (isBillInCurrentPeriod(date, newMod.period_type)) {
            await t.run(`
              UPDATE fund_modules SET spent_amount = spent_amount + ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND user_id = ?
            `, [amount, fund_module_id, userId]);
          }
        }
      }

      // 更新账单
      await t.run(`
        UPDATE bills SET type = ?, amount = ?, category_id = ?, fund_module_id = ?,
          date = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [type, amount, category_id, type === 'expense' ? fund_module_id : null, date, remark || '', billId, userId]);
    });

    const bill = await db.get(`
      SELECT b.*, c.name as category_name, c.icon as category_icon,
             f.name as fund_module_name
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN fund_modules f ON b.fund_module_id = f.id
      WHERE b.id = ?
    `, [billId]);

    res.json({ bill, message: '账单修改成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '修改账单失败' });
  }
});

// 删除账单
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const billId = parseInt(req.params.id);
    const userId = req.user.id;

    const bill = await db.get('SELECT * FROM bills WHERE id = ? AND user_id = ?', [billId, userId]);
    if (!bill) {
      return res.status(404).json({ error: '账单不存在' });
    }

    await db.transaction(async (t) => {
      // 恢复模块金额（先跨周期对齐；仅当该账单属于模块当前周期才回退）
      if (bill.type === 'expense' && bill.fund_module_id) {
        const delMod = await t.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [bill.fund_module_id, userId]);
        if (delMod) {
          await resetModuleSpent(t, delMod);
          if (isBillInCurrentPeriod(bill.date, delMod.period_type)) {
            await t.run(`
              UPDATE fund_modules SET spent_amount = GREATEST(0, spent_amount - ?), updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND user_id = ?
            `, [bill.amount, bill.fund_module_id, userId]);
          }
        }
      }

      // 删除账单
      await t.run('DELETE FROM bills WHERE id = ? AND user_id = ?', [billId, userId]);
    });

    res.json({ message: '账单已删除，对应资金模块金额已恢复' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除账单失败' });
  }
});

// 按分类获取账单（用于统计页点击查看明细）
router.get('/by-category/:categoryId', authMiddleware, async (req, res) => {
  try {
    const bills = await db.all(`
      SELECT b.*, c.name as category_name, c.icon as category_icon
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.category_id = ? AND b.user_id = ?
      ORDER BY b.date DESC
    `, [req.params.categoryId, req.user.id]);
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ error: '获取账单失败' });
  }
});

module.exports = router;
