const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../auth');

// 获取分类列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query;
    const userId = req.user.id;

    let groups;
    if (type) {
      groups = await db.all(`
        SELECT * FROM categories WHERE user_id = ? AND type = ? AND parent_id IS NULL AND is_hidden = 0
        ORDER BY sort_order
      `, [userId, type]);
    } else {
      groups = await db.all(`
        SELECT * FROM categories WHERE user_id = ? AND parent_id IS NULL AND is_hidden = 0
        ORDER BY type, sort_order
      `, [userId]);
    }

    const allChildren = await db.all(`
      SELECT * FROM categories WHERE user_id = ? AND parent_id IS NOT NULL AND is_hidden = 0
      ORDER BY sort_order
    `, [userId]);

    const result = groups.map(group => ({
      ...group,
      children: allChildren.filter(c => c.parent_id === group.id)
    }));

    // 也返回隐藏分类（用于管理页面）
    const hiddenCategories = await db.all(`
      SELECT * FROM categories WHERE user_id = ? AND is_hidden = 1 ORDER BY type, sort_order
    `, [userId]);

    res.json({ categories: result, hidden: hiddenCategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取分类失败' });
  }
});

// 获取所有子分类（扁平列表，用于选择器）
router.get('/leaves', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query;
    const userId = req.user.id;

    let categories;
    if (type) {
      categories = await db.all(`
        SELECT c.*, p.name as group_name FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.user_id = ? AND c.type = ? AND c.parent_id IS NOT NULL AND c.is_hidden = 0
        ORDER BY p.sort_order, c.sort_order
      `, [userId, type]);
    } else {
      categories = await db.all(`
        SELECT c.*, p.name as group_name FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.user_id = ? AND c.parent_id IS NOT NULL AND c.is_hidden = 0
        ORDER BY c.type, p.sort_order, c.sort_order
      `, [userId]);
    }

    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: '获取分类失败' });
  }
});

// 创建分类
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, type, parent_id, icon } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: '分类名称和类型不能为空' });
    }

    const result = await db.run(`
      INSERT INTO categories (user_id, name, type, parent_id, icon)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.id, name, type, parent_id || null, icon || '📌']);

    const category = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
    res.json({ category, message: '分类创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建分类失败' });
  }
});

// 修改分类
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, icon, is_hidden, sort_order } = req.body;
    const category = await db.get('SELECT * FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!category) return res.status(404).json({ error: '分类不存在' });

    await db.run(`
      UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon),
        is_hidden = COALESCE(?, is_hidden), sort_order = COALESCE(?, sort_order)
      WHERE id = ? AND user_id = ?
    `, [name || null, icon || null,
      is_hidden !== undefined ? is_hidden : null,
      sort_order !== undefined ? sort_order : null,
      req.params.id, req.user.id]);

    res.json({ message: '分类修改成功' });
  } catch (err) {
    res.status(500).json({ error: '修改分类失败' });
  }
});

// 删除分类
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const category = await db.get('SELECT * FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!category) return res.status(404).json({ error: '分类不存在' });

    // 检查是否有账单引用
    const billCount = await db.get('SELECT CAST(COUNT(*) AS INTEGER) as count FROM bills WHERE category_id = ?', [req.params.id]);
    if (billCount.count > 0) {
      return res.status(400).json({ error: '该分类下有账单记录，无法删除，可以将其隐藏' });
    }

    // 如果是分组，同时删除子分类
    await db.run('DELETE FROM categories WHERE parent_id = ?', [req.params.id]);
    await db.run('DELETE FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    res.json({ message: '分类已删除' });
  } catch (err) {
    res.status(500).json({ error: '删除分类失败' });
  }
});

module.exports = router;
