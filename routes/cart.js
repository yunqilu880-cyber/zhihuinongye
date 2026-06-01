const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// 所有购物车接口需要登录
router.use(authMiddleware);

// GET /api/cart - 获取购物车列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ci.id, ci.quantity, ci.product_id,
              p.name as product_name, p.price, p.original_price, 
              p.image as product_image, p.badge, p.stock, p.is_on_sale
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at DESC`,
      [req.userId]
    );

    // 检查商品是否已下架
    const result = rows.map(item => ({
      ...item,
      available: item.is_on_sale === 1 && item.stock > 0,
    }));

    res.json({ code: 200, data: result });
  } catch (err) {
    console.error('获取购物车失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// POST /api/cart - 添加商品到购物车
router.post('/', async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) {
    return res.status(400).json({ code: 400, msg: '缺少商品ID' });
  }

  try {
    // 验证商品存在且在售
    const [products] = await pool.query(
      'SELECT id, stock, is_on_sale FROM products WHERE id = ?',
      [product_id]
    );
    if (products.length === 0) {
      return res.status(404).json({ code: 404, msg: '商品不存在' });
    }
    if (products[0].is_on_sale !== 1) {
      return res.status(400).json({ code: 400, msg: '该商品已下架' });
    }
    if (products[0].stock < quantity) {
      return res.status(400).json({ code: 400, msg: '库存不足' });
    }

    // 使用 INSERT ... ON DUPLICATE KEY UPDATE
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [req.userId, product_id, quantity, quantity]
    );

    res.json({ code: 200, msg: '已添加到购物车' });
  } catch (err) {
    console.error('添加到购物车失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/cart/:id - 更新购物车商品数量
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ code: 400, msg: '数量至少为1' });
  }

  try {
    const [items] = await pool.query(
      'SELECT ci.product_id, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.user_id = ?',
      [id, req.userId]
    );
    if (items.length === 0) {
      return res.status(404).json({ code: 404, msg: '购物车商品不存在' });
    }
    if (items[0].stock < quantity) {
      return res.status(400).json({ code: 400, msg: '库存不足' });
    }

    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, id, req.userId]
    );
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    console.error('更新购物车失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// DELETE /api/cart/:id - 删除购物车商品
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    res.json({ code: 200, msg: '已移除' });
  } catch (err) {
    console.error('删除购物车商品失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// DELETE /api/cart - 清空购物车
router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.userId]);
    res.json({ code: 200, msg: '购物车已清空' });
  } catch (err) {
    console.error('清空购物车失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;