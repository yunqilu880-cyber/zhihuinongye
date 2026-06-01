const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// 所有订单接口需要登录
router.use(authMiddleware);

// 生成订单号：年月日时分秒 + 4位随机数
function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${y}${m}${d}${h}${min}${s}${rand}`;
}

// POST /api/orders - 创建订单（从购物车下单）
router.post('/', async (req, res) => {
  const { address_id, cart_ids, remark } = req.body;

  if (!address_id) {
    return res.status(400).json({ code: 400, msg: '请选择收货地址' });
  }
  if (!cart_ids || !Array.isArray(cart_ids) || cart_ids.length === 0) {
    return res.status(400).json({ code: 400, msg: '请选择要结算的商品' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 获取收货地址
    const [addresses] = await connection.query(
      'SELECT * FROM addresses WHERE id = ? AND user_id = ?',
      [address_id, req.userId]
    );
    if (addresses.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ code: 400, msg: '收货地址不存在' });
    }
    const addr = addresses[0];
    const fullAddress = `${addr.province}${addr.city}${addr.district} ${addr.detail}`;

    // 2. 查询购物车中选中的商品，并锁定库存
    const placeholders = cart_ids.map(() => '?').join(',');
    const [cartItems] = await connection.query(
      `SELECT ci.id as cart_id, ci.quantity, p.id as product_id, p.name, p.price, p.image, p.stock, p.is_on_sale
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.id IN (${placeholders}) AND ci.user_id = ?
       FOR UPDATE`,
      [...cart_ids, req.userId]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ code: 400, msg: '购物车商品不存在或已失效' });
    }

    // 3. 校验库存和下架状态
    for (const item of cartItems) {
      if (item.is_on_sale !== 1) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          code: 400,
          msg: `「${item.name}」已下架，请重新选择`,
        });
      }
      if (item.stock < item.quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          code: 400,
          msg: `「${item.name}」库存不足（剩余${item.stock}件）`,
        });
      }
    }

    // 4. 计算总金额
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 5. 创建订单
    const orderNo = generateOrderNo();
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, order_no, total_amount, status, receiver_name, receiver_phone, receiver_address, remark)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [req.userId, orderNo, totalAmount, addr.receiver_name, addr.receiver_phone, fullAddress, remark || '']
    );
    const orderId = orderResult.insertId;

    // 6. 创建订单明细
    for (const item of cartItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, product_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.name, item.image, item.price, item.quantity]
      );

      // 扣减库存
      await connection.query('UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?', [
        item.quantity,
        item.quantity,
        item.product_id,
      ]);
    }

    // 7. 删除已下单的购物车商品
    await connection.query(
      `DELETE FROM cart_items WHERE id IN (${placeholders}) AND user_id = ?`,
      [...cart_ids, req.userId]
    );

    await connection.commit();
    connection.release();

    res.json({
      code: 200,
      msg: '下单成功',
      data: {
        order_id: orderId,
        order_no: orderNo,
        total_amount: totalAmount,
      },
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('创建订单失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// GET /api/orders - 获取我的订单列表
router.get('/', async (req, res) => {
  const { page = 1, pageSize = 10, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = 'WHERE o.user_id = ?';
    let params = [req.userId];

    if (status) {
      where += ' AND o.status = ?';
      params.push(status);
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o ${where}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await pool.query(
      `SELECT o.*, 
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
       FROM orders o
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      code: 200,
      data: {
        list: rows,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    });
  } catch (err) {
    console.error('获取订单列表失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// GET /api/orders/:id - 获取订单详情
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ code: 404, msg: '订单不存在' });
    }

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [id]
    );

    res.json({
      code: 200,
      data: {
        ...orders[0],
        items,
      },
    });
  } catch (err) {
    console.error('获取订单详情失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/orders/:id/cancel - 取消订单
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ code: 404, msg: '订单不存在' });
    }
    if (orders[0].status !== 'pending') {
      return res.status(400).json({ code: 400, msg: '仅待支付订单可取消' });
    }

    await pool.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = ?",
      [id]
    );

    // 恢复库存
    const [items] = await pool.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [id]
    );
    for (const item of items) {
      await pool.query(
        'UPDATE products SET stock = stock + ?, sales = sales - ? WHERE id = ?',
        [item.quantity, item.quantity, item.product_id]
      );
    }

    res.json({ code: 200, msg: '订单已取消' });
  } catch (err) {
    console.error('取消订单失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/orders/:id/confirm - 确认收货
router.put('/:id/confirm', async (req, res) => {
  const { id } = req.params;
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ code: 404, msg: '订单不存在' });
    }
    if (orders[0].status !== 'shipped') {
      return res.status(400).json({ code: 400, msg: '仅已发货订单可确认收货' });
    }

    await pool.query(
      "UPDATE orders SET status = 'completed' WHERE id = ?",
      [id]
    );

    res.json({ code: 200, msg: '已确认收货' });
  } catch (err) {
    console.error('确认收货失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;