const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

// POST /api/users/register - 用户注册
router.post(
  '/register',
  [
    body('phone').matches(/^1[3-9]\d{9}$/).withMessage('请输入正确的手机号'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: 400, msg: errors.array()[0].msg });
    }

    const { phone, password, name } = req.body;
    try {
      const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
      if (existing.length > 0) {
        return res.status(400).json({ code: 400, msg: '该手机号已注册' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.query(
        'INSERT INTO users (phone, password, name) VALUES (?, ?, ?)',
        [phone, hashedPassword, name || phone.slice(-4) + '用户']
      );

      const token = jwt.sign(
        { userId: result.insertId, phone },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        code: 200,
        msg: '注册成功',
        data: {
          token,
          user: { id: result.insertId, phone, name: name || phone.slice(-4) + '用户' },
        },
      });
    } catch (err) {
      console.error('注册失败:', err);
      res.status(500).json({ code: 500, msg: '服务器错误' });
    }
  }
);

// POST /api/users/login - 用户登录
router.post(
  '/login',
  [
    body('phone').matches(/^1[3-9]\d{9}$/).withMessage('请输入正确的手机号'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: 400, msg: errors.array()[0].msg });
    }

    const { phone, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
      if (rows.length === 0) {
        return res.status(400).json({ code: 400, msg: '手机号未注册' });
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ code: 400, msg: '密码错误' });
      }

      const token = jwt.sign(
        { userId: user.id, phone: user.phone },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        code: 200,
        msg: '登录成功',
        data: {
          token,
          user: { id: user.id, phone: user.phone, name: user.name, avatar: user.avatar },
        },
      });
    } catch (err) {
      console.error('登录失败:', err);
      res.status(500).json({ code: 500, msg: '服务器错误' });
    }
  }
);

// GET /api/users/me - 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, phone, name, avatar, role, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    res.json({ code: 200, data: rows[0] });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/users/profile - 更新用户信息
router.put('/profile', authMiddleware, async (req, res) => {
  const { name, avatar } = req.body;
  try {
    await pool.query(
      'UPDATE users SET name = ?, avatar = ? WHERE id = ?',
      [name || null, avatar || null, req.userId]
    );
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    console.error('更新用户信息失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;