const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function seedData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'your_database_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'chase_shop',
    charset: 'utf8mb4',
  });

  console.log('✅ 数据库连接成功');

  // 1. 插入分类（先清空再插）
  await connection.query('DELETE FROM products');
  await connection.query('DELETE FROM categories');
  await connection.query('ALTER TABLE categories AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE products AUTO_INCREMENT = 1');

  const [catResult] = await connection.query(`
    INSERT INTO categories (id, name, icon, sort_order) VALUES
    (1, '时令水果', '🍑', 1),
    (2, '精品蔬菜', '🥬', 2),
    (3, '粮油干货', '🌾', 3),
    (4, '禽蛋肉类', '🥚', 4)
  `);
  console.log(`✅ 插入 ${catResult.affectedRows} 条分类数据`);

  // 2. 从 products_export.json 导入完整商品数据
  const productsPath = path.resolve(__dirname, '../products_export.json');
  if (!fs.existsSync(productsPath)) {
    console.log('⚠️  未找到 products_export.json');
    await connection.end();
    process.exit(0);
  }

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  for (const p of products) {
    await connection.query(
      `INSERT INTO products (id, name, description, price, original_price, stock, image, category_id, badge, weight, specs, is_featured, is_on_sale, sales)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.description, p.price, p.original_price, p.stock, p.image, p.category_id, p.badge, p.weight, p.specs, p.is_featured, p.is_on_sale, p.sales || 0]
    );
  }
  console.log(`✅ 插入 ${products.length} 条商品数据`);

  console.log('\n📊 数据初始化完成！');
  // 验证
  const [categories] = await connection.query('SELECT id, name FROM categories ORDER BY id');
  console.log('\n分类：');
  categories.forEach(c => console.log(`   ${c.id}. ${c.name}`));

  const [prodList] = await connection.query('SELECT id, name, price FROM products ORDER BY id LIMIT 10');
  console.log(`\n商品（共${products.length}个，显示前10）：`);
  prodList.forEach(p => console.log(`   ${p.id}. ${p.name}  ¥${p.price}`));

  await connection.end();
  process.exit(0);
}

seedData().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
