const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/addresses - 获取我的收货地址列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.userId]
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    console.error('获取地址列表失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// POST /api/addresses - 新增收货地址
router.post('/', async (req, res) => {
  const { receiver_name, receiver_phone, province, city, district, detail, is_default } = req.body;

  if (!receiver_name || !receiver_phone || !province || !city || !district || !detail) {
    return res.status(400).json({ code: 400, msg: '请填写完整的收货信息' });
  }

  try {
    // 如果设为默认，先取消其他默认地址
    if (is_default) {
      await pool.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [req.userId]
      );
    }

    const [result] = await pool.query(
      `INSERT INTO addresses (user_id, receiver_name, receiver_phone, province, city, district, detail, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, receiver_name, receiver_phone, province, city, district, detail, is_default ? 1 : 0]
    );

    res.json({
      code: 200,
      msg: '地址添加成功',
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error('新增地址失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/addresses/:id - 更新收货地址
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { receiver_name, receiver_phone, province, city, district, detail, is_default } = req.body;

  try {
    // 验证归属
    const [exist] = await pool.query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (exist.length === 0) {
      return res.status(404).json({ code: 404, msg: '地址不存在' });
    }

    if (is_default) {
      await pool.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [req.userId]
      );
    }

    await pool.query(
      `UPDATE addresses 
       SET receiver_name = ?, receiver_phone = ?, province = ?, city = ?, 
           district = ?, detail = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [
        receiver_name, receiver_phone, province, city,
        district, detail, is_default ? 1 : 0,
        id, req.userId,
      ]
    );

    res.json({ code: 200, msg: '地址更新成功' });
  } catch (err) {
    console.error('更新地址失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// DELETE /api/addresses/:id - 删除收货地址
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    res.json({ code: 200, msg: '地址已删除' });
  } catch (err) {
    console.error('删除地址失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;