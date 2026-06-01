const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/products - 获取商品列表（支持分页、分类筛选、搜索）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, category_id, keyword, is_featured } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let where = ['p.is_on_sale = 1'];
    let params = [];

    if (category_id) {
      where.push('p.category_id = ?');
      params.push(category_id);
    }
    if (is_featured === '1') {
      where.push('p.is_featured = 1');
    }
    if (keyword) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.original_price, p.stock, 
              p.image, p.category_id, c.name as category_name, p.badge, p.weight, 
              p.specs, p.is_featured, p.sales
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.is_featured DESC, p.sales DESC, p.id ASC
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
    console.error('获取商品列表失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// GET /api/products/categories - 获取全部分类
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, icon FROM categories ORDER BY sort_order ASC'
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    console.error('获取分类失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

// GET /api/products/:id - 获取商品详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '商品不存在' });
    }
    res.json({ code: 200, data: rows[0] });
  } catch (err) {
    console.error('获取商品详情失败:', err);
    res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;