const mysql = require('mysql2/promise');
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

  // 2. 插入商品
  const [prodResult] = await connection.query(`
    INSERT INTO products (name, description, price, original_price, stock, image, category_id, badge, weight, specs, is_featured, is_on_sale) VALUES
    ('精品杨梅 3斤装', '余姚当季杨梅，当天清晨采摘，单果12g+，冰袋+泡沫箱保鲜包装', 89.00, 108.00, 999, '/images/project-1-thumb.jpg', 1, '家庭尝鲜', '3斤/箱', '精选大果·单果12g+\\n当天清晨采摘\\n冰袋+泡沫箱保鲜包装\\n江浙沪次日达', 1, 1),
    ('甄选礼盒 5斤装', '特选大果杨梅，单果15g+，品牌礼盒送礼体面，产地溯源二维码', 158.00, 198.00, 500, '/images/project-2-thumb.jpg', 1, '送礼推荐', '5斤/箱', '特选大果·单果15g+\\n品牌礼盒·送礼体面\\n产地溯源二维码\\n顺丰冷链配送', 1, 1),
    ('有机大米 10斤装', '东北五常稻花香，有机认证，颗粒饱满香甜软糯', 49.00, 65.00, 300, '/images/project-3-thumb.jpg', 3, '热卖', '10斤/袋', '五常稻花香2号\\n有机认证\\n真空包装', 1, 1),
    ('农家土鸡蛋 30枚装', '林间散养土鸡蛋，蛋黄饱满，无抗生素无激素', 45.00, 52.00, 200, '/images/project-4-thumb.jpg', 4, '新品', '30枚/箱', '林间散养\\n蛋黄橙黄饱满\\n珍珠棉防震包装', 1, 1),
    ('有机蔬菜礼盒 8斤装', '当天采摘时令有机蔬菜8种搭配，健康新鲜直达', 68.00, 88.00, 150, '/images/project-5-thumb.jpg', 2, '推荐', '8斤/箱', '8种时令搭配\\n有机认证\\n冷链保鲜', 1, 1),
    ('杨梅汁 6瓶装', '鲜榨杨梅汁，原汁原味无添加，冰镇更美味', 36.00, 42.00, 600, '/images/project-6-thumb.jpg', 1, '热卖', '6瓶/箱', '330ml/瓶\\nNFC鲜榨工艺\\n冷藏口感更佳', 0, 1)
  `);
  console.log(`✅ 插入 ${prodResult.affectedRows} 条商品数据`);

  console.log('\n📊 数据初始化完成！');
  // 验证
  const [categories] = await connection.query('SELECT id, name FROM categories ORDER BY id');
  console.log('\n分类：');
  categories.forEach(c => console.log(`   ${c.id}. ${c.name}`));

  const [products] = await connection.query('SELECT id, name, price FROM products ORDER BY id');
  console.log('\n商品：');
  products.forEach(p => console.log(`   ${p.id}. ${p.name}  ¥${p.price}`));

  await connection.end();
  process.exit(0);
}

seedData().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});