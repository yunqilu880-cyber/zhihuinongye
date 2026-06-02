const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Admin 认证中间件 - 验证 JWT + 检查 role=admin
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    // 检查是否为管理员
    pool.query('SELECT role FROM users WHERE id = ?', [decoded.userId])
      .then(([rows]) => {
        if (rows.length === 0 || rows[0].role !== 'admin') {
          return res.status(403).json({ code: 403, msg: '无管理员权限' });
        }
        next();
      })
      .catch(() => res.status(500).json({ code: 500, msg: '服务器错误' }));
  } catch (err) {
    return res.status(401).json({ code: 401, msg: '登录已过期' });
  }
}

// 所有管理接口需要 admin 权限
router.use(adminAuth);

// ========== 用户管理 ==========

// GET /api/admin/users - 用户列表
router.get('/users', async (req, res) => {
  const { page = 1, pageSize = 20, keyword } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  try {
    let where = 'WHERE 1=1';
    let params = [];
    
    if (keyword) {
      where += ' AND (username LIKE ? OR name LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw);
    }

    const [count] = await pool.query(`SELECT COUNT(*) as total FROM users ${where}`, params);
    const total = count[0].total;

    const [rows] = await pool.query(
      `SELECT id, username, name, avatar, role, created_at, updated_at 
       FROM users ${where} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      code: 200,
      data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) }
    });
  } catch (err) {
    console.error('获取用户列表失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/admin/users/:id/role - 修改用户角色
router.put('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ code: 400, msg: '无效的角色' });
  }

  try {
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ code: 200, msg: '角色更新成功' });
  } catch (err) {
    console.error('更新角色失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// DELETE /api/admin/users/:id - 删除用户
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (users[0].role === 'admin') {
      return res.status(400).json({ code: 400, msg: '不能删除管理员账号' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ code: 200, msg: '用户已删除' });
  } catch (err) {
    console.error('删除用户失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// ========== 订单管理 ==========

// GET /api/admin/orders - 全部订单列表
router.get('/orders', async (req, res) => {
  const { page = 1, pageSize = 20, status, keyword } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  try {
    let where = 'WHERE 1=1';
    let params = [];

    if (status) {
      where += ' AND o.status = ?';
      params.push(status);
    }
    if (keyword) {
      where += ' AND (o.order_no LIKE ? OR o.receiver_name LIKE ? OR o.receiver_phone LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    const [count] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o ${where}`,
      params
    );
    const total = count[0].total;

    const [rows] = await pool.query(
      `SELECT o.*, u.username, u.name as user_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      code: 200,
      data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) }
    });
  } catch (err) {
    console.error('获取订单列表失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// GET /api/admin/orders/:id - 订单详情
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [orders] = await pool.query(
      `SELECT o.*, u.username, u.name as user_name 
       FROM orders o LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ code: 404, msg: '订单不存在' });
    }

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [id]
    );

    res.json({ code: 200, data: { ...orders[0], items } });
  } catch (err) {
    console.error('获取订单详情失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// PUT /api/admin/orders/:id/status - 修改订单状态
router.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ code: 400, msg: '无效的状态' });
  }

  try {
    const updateFields = { status };
    if (status === 'shipped') {
      updateFields.shipped_at = new Date();
    }

    const updates = Object.entries(updateFields)
      .map(([key]) => `${key} = ?`)
      .join(', ');
    const values = Object.values(updateFields);

    await pool.query(`UPDATE orders SET ${updates} WHERE id = ?`, [...values, id]);
    res.json({ code: 200, msg: '状态更新成功' });
  } catch (err) {
    console.error('更新订单状态失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// ========== 商品管理 ==========

// GET /api/admin/products - 全部商品列表
router.get('/products', async (req, res) => {
  const { page = 1, pageSize = 20, keyword, category_id, is_on_sale } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  try {
    let where = 'WHERE 1=1';
    let params = [];
    if (keyword) { where += ' AND (p.name LIKE ? OR p.description LIKE ?)'; const kw = `%${keyword}%`; params.push(kw, kw); }
    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
    if (is_on_sale !== undefined && is_on_sale !== '') { where += ' AND p.is_on_sale = ?'; params.push(parseInt(is_on_sale)); }
    
    const [count] = await pool.query(`SELECT COUNT(*) as total FROM products p ${where}`, params);
    const total = count[0].total;

    const [rows] = await pool.query(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    res.json({ code: 200, data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) } });
  } catch (err) { console.error('获取商品列表失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// POST /api/admin/products - 新增商品
router.post('/products', async (req, res) => {
  const { name, description, price, original_price, stock, image, category_id, badge, weight, specs, is_featured, is_on_sale } = req.body;
  if (!name || !price) return res.status(400).json({ code: 400, msg: '名称和价格必填' });
  try {
    const [result] = await pool.query(
      `INSERT INTO products (name, description, price, original_price, stock, image, category_id, badge, weight, specs, is_featured, is_on_sale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, description||'', price, original_price||null, stock||0, image||'', category_id||null, badge||'', weight||'', specs||'', is_featured||0, is_on_sale!==undefined?is_on_sale:1]
    );
    res.json({ code: 200, msg: '商品添加成功', data: { id: result.insertId } });
  } catch (err) { console.error('添加商品失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// PUT /api/admin/products/:id - 更新商品
router.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['name','description','price','original_price','stock','image','category_id','badge','weight','specs','is_featured','is_on_sale'];
  const updates = [];
  const values = [];
  fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f}=?`); values.push(req.body[f]); } });
  if (updates.length === 0) return res.status(400).json({ code: 400, msg: '无更新字段' });
  try {
    await pool.query(`UPDATE products SET ${updates.join(',')} WHERE id=?`, [...values, id]);
    res.json({ code: 200, msg: '商品更新成功' });
  } catch (err) { console.error('更新商品失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// DELETE /api/admin/products/:id - 删除商品
router.delete('/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({ code: 200, msg: '商品已删除' });
  } catch (err) { console.error('删除商品失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// PUT /api/admin/products/:id/toggle - 上下架
router.put('/products/:id/toggle', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_on_sale FROM products WHERE id=?', [req.params.id]);
    if (rows.length===0) return res.status(404).json({ code:404, msg:'商品不存在' });
    const newStatus = rows[0].is_on_sale ? 0 : 1;
    await pool.query('UPDATE products SET is_on_sale=? WHERE id=?', [newStatus, req.params.id]);
    res.json({ code:200, msg: newStatus?'已上架':'已下架', data:{ is_on_sale: newStatus } });
  } catch (err) { console.error('上下架失败:', err); res.status(500).json({ code:500, msg:'服务器错误' }); }
});

// ========== 分类管理 ==========

// GET /api/admin/categories - 分类列表
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
    res.json({ code: 200, data: rows });
  } catch (err) { console.error('获取分类失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// POST /api/admin/categories - 新增分类
router.post('/categories', async (req, res) => {
  const { name, icon, sort_order } = req.body;
  if (!name) return res.status(400).json({ code: 400, msg: '分类名称必填' });
  try {
    const [result] = await pool.query('INSERT INTO categories (name, icon, sort_order) VALUES (?,?,?)', [name, icon||'', sort_order||0]);
    res.json({ code: 200, msg: '分类添加成功', data: { id: result.insertId } });
  } catch (err) { console.error('添加分类失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// PUT /api/admin/categories/:id - 更新分类
router.put('/categories/:id', async (req, res) => {
  const { name, icon, sort_order } = req.body;
  try {
    await pool.query('UPDATE categories SET name=?, icon=?, sort_order=? WHERE id=?', [name, icon||'', sort_order||0, req.params.id]);
    res.json({ code: 200, msg: '分类更新成功' });
  } catch (err) { console.error('更新分类失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// DELETE /api/admin/categories/:id - 删除分类
router.delete('/categories/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=?', [req.params.id]);
    res.json({ code: 200, msg: '分类已删除' });
  } catch (err) { console.error('删除分类失败:', err); res.status(500).json({ code: 500, msg: '服务器错误' }); }
});

// ========== 统计数据 ==========

// GET /api/admin/stats - 管理面板统计数据
router.get('/stats', async (req, res) => {
  try {
    const [[userCount]] = await pool.query('SELECT COUNT(*) as total FROM users');
    const [[productCount]] = await pool.query('SELECT COUNT(*) as total FROM products');
    const [[orderCount]] = await pool.query('SELECT COUNT(*) as total FROM orders');
    const [[totalRevenue]] = await pool.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status IN ('paid','shipped','delivered','completed')");
    const [[pendingOrders]] = await pool.query("SELECT COUNT(*) as total FROM orders WHERE status = 'pending'");

    res.json({
      code: 200,
      data: {
        userCount: userCount.total,
        productCount: productCount.total,
        orderCount: orderCount.total,
        totalRevenue: totalRevenue.total,
        pendingOrders: pendingOrders.total,
      }
    });
  } catch (err) {
    console.error('获取统计数据失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;