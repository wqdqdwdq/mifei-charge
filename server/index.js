const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const billRoutes = require('./routes/bills');
const categoryRoutes = require('./routes/categories');
const moduleRoutes = require('./routes/modules');
const statsRoutes = require('./routes/stats');
const familyRoutes = require('./routes/family');
const { initSchema } = require('./db');

const app = express();
const HOST = '127.0.0.1';
const PORT = parseInt(process.env.PORT || '8080', 10);

// Middleware
app.use(cors());
app.use(express.json());

// 上传文件静态服务（前端通过 /uploads/xxx 访问）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/family', familyRoutes);

// 未知 API 路径
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

(async () => {
  try {
    await initSchema();
    console.log('✅ 数据库表结构已就绪');
  } catch (err) {
    console.error('❌ 初始化数据库失败：', err);
  }
  app.listen(PORT, HOST, () => {
    console.log(`✨ 米菲记账后端已启动：${HOST}:${PORT}`);
  });
})();
