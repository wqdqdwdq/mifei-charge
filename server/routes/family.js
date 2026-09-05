const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../auth');
const crypto = require('crypto');

// 邀请码有效期（分钟），与下方 SQL 的 INTERVAL 保持一致
const CODE_TTL_MINUTES = 10;

/**
 * 家庭模块：授权对方查看自己的账本（严格只读）
 *
 * 授权语义：family_links(user_id, partner_id, status='accepted')
 *   表示「user_id 已授权 partner_id 查看自己的数据」。
 * 建立家庭关系时双方各写一条，因此是双向互看；任一方解除则两条同时删除。
 *
 * 安全约定：
 *   1. 一切读取对方数据的接口，都必须先校验「对方 → 我」这条 accepted 记录存在；
 *   2. 本文件不提供任何写入他人数据的能力（只读）；
 *   3. 所有 SQL 一律参数化，禁止拼接用户输入。
 */

// 月份起止日期（bills.date 为 TEXT 'YYYY-MM-DD'，可直接字典序比较）
function monthRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  const mm = String(m).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(lastDay).padStart(2, '0')}`];
}

// 我当前已建立的家庭关系（我 → 对方，accepted）
async function getAcceptedPartner(userId) {
  return await db.get(`
    SELECT l.id, l.partner_id, l.accepted_at,
           u.username AS partner_username, u.avatar AS partner_avatar
    FROM family_links l
    JOIN users u ON u.id = l.partner_id
    WHERE l.user_id = ? AND l.status = 'accepted'
    LIMIT 1
  `, [userId]);
}

// 校验「partnerId 是否已授权 me 查看他的数据」
async function assertCanView(me, partnerId) {
  if (!partnerId) return null;
  return await db.get(`
    SELECT id FROM family_links
    WHERE user_id = ? AND partner_id = ? AND status = 'accepted'
  `, [partnerId, me]);
}

// ==================== 关系状态 ====================
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const partner = await getAcceptedPartner(me);

    res.json({
      bound: !!partner,
      partner: partner ? {
        id: partner.partner_id,
        username: partner.partner_username,
        avatar: partner.partner_avatar,
        since: partner.accepted_at
      } : null
    });
  } catch (err) {
    console.error('family/status 失败：', err);
    res.status(500).json({ error: '获取家庭关系失败' });
  }
});

// ==================== 解除家庭关系 ====================
router.delete('/unlink', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const partner = await getAcceptedPartner(me);
    if (!partner) return res.status(400).json({ error: '当前没有家庭关系' });

    await db.run(
      `DELETE FROM family_links
       WHERE (user_id = ? AND partner_id = ?) OR (user_id = ? AND partner_id = ?)`,
      [me, partner.partner_id, partner.partner_id, me]
    );

    res.json({ success: true, message: '已解除家庭关系' });
  } catch (err) {
    console.error('family/unlink 失败：', err);
    res.status(500).json({ error: '解除家庭关系失败' });
  }
});

// ==================== 双人月度概览 ====================
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const [startDate, endDate] = monthRange(year, month);

    const partner = await getAcceptedPartner(me);
    if (!partner) return res.json({ bound: false });

    // 关键：确认对方确实授权了我，杜绝越权读取
    const authorized = await assertCanView(me, partner.partner_id);
    if (!authorized) return res.status(403).json({ error: '未获得对方授权' });

    const sumSql = `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS income,
        COUNT(*) FILTER (WHERE type = 'expense') AS expense_count
      FROM bills
      WHERE user_id = ? AND date >= ? AND date <= ?
    `;

    const mine = await db.get(sumSql, [me, startDate, endDate]);
    const theirs = await db.get(sumSql, [partner.partner_id, startDate, endDate]);

    // 对方各分类支出（用于对比谁花在哪）
    const myCats = await db.all(`
      SELECT c.name, COALESCE(SUM(b.amount), 0) AS total
      FROM bills b LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.type = 'expense' AND b.date >= ? AND b.date <= ?
      GROUP BY c.name ORDER BY total DESC LIMIT 5
    `, [me, startDate, endDate]);

    const theirCats = await db.all(`
      SELECT c.name, COALESCE(SUM(b.amount), 0) AS total
      FROM bills b LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.type = 'expense' AND b.date >= ? AND b.date <= ?
      GROUP BY c.name ORDER BY total DESC LIMIT 5
    `, [partner.partner_id, startDate, endDate]);

    res.json({
      bound: true,
      year, month,
      me: {
        id: me,
        username: req.user.username,
        expense: Number(mine.expense),
        income: Number(mine.income),
        expenseCount: Number(mine.expense_count),
        topCategories: myCats
      },
      partner: {
        id: partner.partner_id,
        username: partner.partner_username,
        avatar: partner.partner_avatar,
        expense: Number(theirs.expense),
        income: Number(theirs.income),
        expenseCount: Number(theirs.expense_count),
        topCategories: theirCats
      },
      total: {
        expense: Number(mine.expense) + Number(theirs.expense),
        income: Number(mine.income) + Number(theirs.income)
      }
    });
  } catch (err) {
    console.error('family/overview 失败：', err);
    res.status(500).json({ error: '获取家庭概览失败' });
  }
});

// ==================== 合并账单时间线（只读） ====================
router.get('/bills', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const who = ['all', 'me', 'partner'].includes(req.query.who) ? req.query.who : 'all';
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const [startDate, endDate] = monthRange(year, month);

    const partner = await getAcceptedPartner(me);
    if (!partner) return res.json({ bound: false, bills: [], total: 0, page, totalPages: 0 });

    const authorized = await assertCanView(me, partner.partner_id);
    if (!authorized) return res.status(403).json({ error: '未获得对方授权' });

    let userIds = [me, partner.partner_id];
    if (who === 'me') userIds = [me];
    if (who === 'partner') userIds = [partner.partner_id];

    const placeholders = userIds.map(() => '?').join(',');

    const rows = await db.all(`
      SELECT b.id, b.date, b.type, b.amount, b.remark, b.user_id,
             c.name AS category_name, c.icon AS category_icon,
             u.username AS owner_name
      FROM bills b
      LEFT JOIN categories c ON b.category_id = c.id
      JOIN users u ON b.user_id = u.id
      WHERE b.user_id IN (${placeholders}) AND b.date >= ? AND b.date <= ?
      ORDER BY b.date DESC, b.id DESC
      LIMIT ? OFFSET ?
    `, [...userIds, startDate, endDate, limit, (page - 1) * limit]);

    const totalRow = await db.get(`
      SELECT COUNT(*) AS total FROM bills
      WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?
    `, [...userIds, startDate, endDate]);

    const total = Number(totalRow.total);

    res.json({
      bound: true,
      year, month, who,
      bills: rows.map(b => ({
        ...b,
        owner: b.user_id === me ? 'me' : 'partner'
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('family/bills 失败：', err);
    res.status(500).json({ error: '获取家庭账单失败' });
  }
});

// ==================== 生成 6 位邀请码 ====================
router.post('/generate-code', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;

    const partner = await getAcceptedPartner(me);
    if (partner) return res.status(400).json({ error: '你们已经是家庭关系了' });

    // 作废本人此前未使用的码，保证同一时刻只有一个有效码
    await db.run('DELETE FROM family_invite_codes WHERE user_id = ? AND used_at IS NULL', [me]);

    // 极低概率撞已有未过期的码，重试几次
    let code = null;
    for (let i = 0; i < 5; i++) {
      const candidate = String(crypto.randomInt(100000, 1000000));
      const exists = await db.get('SELECT id FROM family_invite_codes WHERE code = ?', [candidate]);
      if (!exists) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: '生成邀请码失败，请重试' });

    await db.run(
      `INSERT INTO family_invite_codes (user_id, code, expires_at)
       VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
      [me, code]
    );

    res.json({ success: true, code, expiresInMinutes: CODE_TTL_MINUTES });
  } catch (err) {
    console.error('family/generate-code 失败：', err);
    res.status(500).json({ error: '生成邀请码失败' });
  }
});

// ==================== 用邀请码绑定（一次性） ====================
router.post('/redeem-code', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const code = String(req.body.code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '请输入 6 位数字邀请码' });

    const mine = await getAcceptedPartner(me);
    if (mine) return res.status(400).json({ error: '你们已经是家庭关系了' });

    const rec = await db.get('SELECT * FROM family_invite_codes WHERE code = ?', [code]);
    if (!rec) return res.status(404).json({ error: '邀请码不存在，请确认后重试' });
    if (rec.used_at) return res.status(400).json({ error: '该邀请码已被使用' });
    if (rec.user_id === me) return res.status(400).json({ error: '不能使用自己生成的邀请码' });
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: '邀请码已过期，请让对方重新生成' });

    const owner = rec.user_id;
    const ownerBound = await getAcceptedPartner(owner);
    if (ownerBound) return res.status(400).json({ error: '对方已与其他账号建立家庭关系' });

    // 事务内完成：标记码已用 + 建立双向绑定，防止并发重复兑换
    await db.transaction(async (t) => {
      const upd = await t.run(
        `UPDATE family_invite_codes SET used_at = CURRENT_TIMESTAMP, used_by = ?
         WHERE id = ? AND used_at IS NULL`,
        [me, rec.id]
      );
      if (!upd.changes) throw new Error('CODE_ALREADY_USED');

      const link = (a, b) => t.run(
        `INSERT INTO family_links (user_id, partner_id, status, accepted_at)
         VALUES (?, ?, 'accepted', CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, partner_id)
         DO UPDATE SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP`,
        [a, b]
      );
      await link(owner, me);   // 对方授权我
      await link(me, owner);   // 我授权对方 → 双向互看
    });

    res.json({ success: true, message: '绑定成功，双方可互相查看' });
  } catch (err) {
    if (err && err.message === 'CODE_ALREADY_USED') {
      return res.status(400).json({ error: '该邀请码已被使用' });
    }
    console.error('family/redeem-code 失败：', err);
    res.status(500).json({ error: '绑定失败' });
  }
});

module.exports = router;
