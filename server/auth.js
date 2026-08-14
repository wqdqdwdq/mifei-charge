const jwt = require('jsonwebtoken');
const { getUserById } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'miffy-account-secret-key-2024';
const JWT_EXPIRES = '30d';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = { generateToken, authMiddleware, JWT_SECRET };
