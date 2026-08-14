const express = require('express');
const router = express.Router();
const { db, createUser, verifyUser, getUserById } = require('../db');
const { generateToken, authMiddleware } = require('../auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 头像上传配置
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const avatarUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度需要在2-20个字符之间' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6位' });
    }

    const userId = await createUser(username, password);
    const token = generateToken(userId);
    const newUser = await db.get('SELECT id, username, avatar FROM users WHERE id = ?', [userId]);
    res.json({
      token,
      user: newUser
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = await verifyUser(username, password);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user.id);
    const fullUser = await db.get('SELECT id, username, avatar FROM users WHERE id = ?', [user.id]);
    res.json({
      token,
      user: fullUser
    });
  } catch (err) {
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT id, username, avatar FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: user || req.user });
});

// 上传头像
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择图片' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `avatar-${req.user.id}-${Date.now()}${ext}`;
    const destPath = path.join(uploadDir, filename);
    fs.renameSync(req.file.path, destPath);

    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [filename, req.user.id]);
    res.json({ ok: true, filename, url: `/uploads/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '上传头像失败' });
  }
});

// 修改密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json({ error: '原密码错误' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度不能少于6位' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ message: '密码修改成功' });
  } catch (err) {
    res.status(500).json({ error: '修改密码失败' });
  }
});

module.exports = router;
