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
    body('username').isLength({ min: 1 }).withMessage('请输入账号'),
    body('password').isLength({ min: 1 }).withMessage('请输入密码'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: 400, msg: errors.array()[0].msg });
    }

    const { username, password, name } = req.body;
    try {
      const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length > 0) {
        return res.status(400).json({ code: 400, msg: '该账号已注册' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.query(
        'INSERT INTO users (username, password, name) VALUES (?, ?, ?)',
        [username, hashedPassword, name || username]
      );

      const token = jwt.sign(
        { userId: result.insertId, username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        code: 200,
        msg: '注册成功',
        data: {
          token,
          user: { id: result.insertId, username, name: name || username },
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
    body('username').notEmpty().withMessage('请输入账号'),
    body('password').notEmpty().withMessage('请输入密码'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ code: 400, msg: errors.array()[0].msg });
    }

    const { username, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        return res.status(400).json({ code: 400, msg: '账号不存在' });
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ code: 400, msg: '密码错误' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        code: 200,
        msg: '登录成功',
        data: {
          token,
          user: { id: user.id, username: user.username, name: user.name, avatar: user.avatar },
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
      'SELECT id, username, name, avatar, role, created_at FROM users WHERE id = ?',
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

// PUT /api/users/password - 修改密码
router.put('/password', authMiddleware, [
  body('oldPassword').notEmpty().withMessage('请输入原密码'),
  body('newPassword').isLength({ min: 1 }).withMessage('请输入新密码'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ code: 400, msg: errors.array()[0].msg });
  
  const { oldPassword, newPassword } = req.body;
  try {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.userId]);
    if (rows.length === 0) return res.status(404).json({ code: 404, msg: '用户不存在' });
    
    const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isMatch) return res.status(400).json({ code: 400, msg: '原密码错误' });
    
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.userId]);
    res.json({ code: 200, msg: '密码修改成功' });
  } catch (err) {
    console.error('修改密码失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;
