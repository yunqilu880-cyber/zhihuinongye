const m = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');

(async () => {
  const c = await m.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await c.query('DELETE FROM products');
  const products = JSON.parse(fs.readFileSync('products_export.json', 'utf8'));

  for (const p of products) {
    await c.query(
      'INSERT INTO products (id,name,description,price,original_price,stock,image,category_id,badge,weight,specs,is_featured,is_on_sale,sales) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [p.id, p.name, p.description, p.price, p.original_price, p.stock, p.image, p.category_id, p.badge, p.weight, p.specs, p.is_featured, p.is_on_sale, p.sales || 0]
    );
  }
  console.log('Imported', products.length, 'products');
  await c.end();
})();