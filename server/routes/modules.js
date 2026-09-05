const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { authMiddleware } = require('../auth');
const { resetModuleSpent } = require('../periodUtil');

// 上传配置
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const name = `mod-icon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许图片文件'), false);
  }
});

// 获取所有资金模块
router.get('/', authMiddleware, async (req, res) => {
  try {
    const modules = await db.all(`
      SELECT * FROM fund_modules WHERE user_id = ? ORDER BY sort_order, created_at
    `, [req.user.id]);

    // 跨周期自动清零已用金额（预算不变 = 继承上月金额）
    await Promise.all(modules.map(m => resetModuleSpent(db, m)));

    // 计算剩余金额
    const result = modules.map(m => ({
      ...m,
      remaining_amount: m.budget_amount - m.spent_amount,
      progress: m.budget_amount > 0 ? Math.round((m.spent_amount / m.budget_amount) * 1000) / 10 : 0
    }));

    res.json({ modules: result });
  } catch (err) {
    res.status(500).json({ error: '获取资金模块失败' });
  }
});

// 获取单个资金模块
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const module = await db.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);

    if (!module) return res.status(404).json({ error: '资金模块不存在' });

    // 跨周期自动清零已用金额（预算不变 = 继承上月金额）
    await resetModuleSpent(db, module);

    const billCount = await db.get('SELECT CAST(COUNT(*) AS INTEGER) as count FROM bills WHERE fund_module_id = ?', [req.params.id]);

    res.json({
      module: {
        ...module,
        remaining_amount: module.budget_amount - module.spent_amount,
        progress: module.budget_amount > 0 ? Math.round((module.spent_amount / module.budget_amount) * 1000) / 10 : 0,
        bill_count: billCount.count
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取资金模块失败' });
  }
});

// 创建资金模块
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, icon, budget_amount, period_type, default_category_id, remark, sort_order } = req.body;

    if (!name || !budget_amount) {
      return res.status(400).json({ error: '模块名称和金额不能为空' });
    }

    const result = await db.run(`
      INSERT INTO fund_modules (user_id, name, icon, budget_amount, period_type, default_category_id, remark, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, name, icon || '🐰', budget_amount, period_type || 'monthly',
      default_category_id || null, remark || '', sort_order || 0]);

    const module = await db.get('SELECT * FROM fund_modules WHERE id = ?', [result.lastInsertRowid]);
    res.json({
      module: {
        ...module,
        remaining_amount: module.budget_amount,
        progress: 0
      },
      message: '资金模块创建成功'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建资金模块失败' });
  }
});

// 修改资金模块
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await db.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [moduleId, userId]);
    if (!existing) return res.status(404).json({ error: '资金模块不存在' });

    const { name, icon, budget_amount, period_type, default_category_id, remark, sort_order } = req.body;

    await db.run(`
      UPDATE fund_modules SET
        name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        budget_amount = COALESCE(?, budget_amount),
        period_type = COALESCE(?, period_type),
        default_category_id = ?,
        remark = COALESCE(?, remark),
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [
      name || null, icon || null,
      budget_amount !== undefined ? budget_amount : null,
      period_type || null,
      default_category_id !== undefined ? default_category_id : existing.default_category_id,
      remark !== undefined ? remark : null,
      sort_order !== undefined ? sort_order : null,
      moduleId, userId
    ]);

    const module = await db.get('SELECT * FROM fund_modules WHERE id = ?', [moduleId]);
    res.json({
      module: {
        ...module,
        remaining_amount: module.budget_amount - module.spent_amount,
        progress: module.budget_amount > 0 ? Math.round((module.spent_amount / module.budget_amount) * 1000) / 10 : 0
      },
      message: '资金模块修改成功'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '修改资金模块失败' });
  }
});

// 删除资金模块
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await db.get('SELECT * FROM fund_modules WHERE id = ? AND user_id = ?', [moduleId, userId]);
    if (!existing) return res.status(404).json({ error: '资金模块不存在' });

    // 检查是否有账单引用
    const billCount = await db.get('SELECT CAST(COUNT(*) AS INTEGER) as count FROM bills WHERE fund_module_id = ?', [moduleId]);
    if (billCount.count > 0) {
      return res.status(400).json({ error: `该模块下有 ${billCount.count} 条账单记录，请先将账单转移到其他模块后再删除` });
    }

    await db.run('DELETE FROM fund_modules WHERE id = ? AND user_id = ?', [moduleId, userId]);
    res.json({ message: '资金模块已删除' });
  } catch (err) {
    res.status(500).json({ error: '删除资金模块失败' });
  }
});

// 上传模块图标
router.post('/upload-icon', authMiddleware, (req, res) => {
  upload.single('icon')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 5MB' : '上传失败' });
      }
      return res.status(400).json({ error: err.message || '上传失败' });
    }
    if (!req.file) return res.status(400).json({ error: '请选择文件' });

    const filename = req.file.filename;
    res.json({
      ok: true,
      filename,
      url: `/uploads/${filename}`
    });
  });
});

module.exports = router;
