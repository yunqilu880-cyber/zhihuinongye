const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
// helmet 在开发阶段禁用（安全头可能导致外部浏览器加载失败）
// app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（前端页面 + CSS/JS/图片）
app.use(express.static(__dirname));

// 路由
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/addresses', require('./routes/addresses'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, msg: 'ok', time: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ code: 404, msg: '接口不存在' });
  }
  // 非 API 请求返回首页（SPA 模式）
  res.redirect('/');
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, msg: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 智慧农业电商后端已启动`);
  console.log(`   地址：http://localhost:${PORT}`);
  console.log(`   API：http://localhost:${PORT}/api/health\n`);
});