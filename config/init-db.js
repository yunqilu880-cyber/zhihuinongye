const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  let connection;
  try {
    // 先连接不指定数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'your_database_user',
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4',
    });

    console.log('✅ 数据库连接成功');

    // 创建数据库
    await connection.query(`
      CREATE DATABASE IF NOT EXISTS chase_shop 
      CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci
    `);
    console.log('✅ 数据库 chase_shop 已就绪');

    await connection.query('USE chase_shop');

    // 读取 SQL 文件
    const sqlPath = path.resolve(__dirname, 'init.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // 移除 USE 语句
    sql = sql.replace(/^USE chase_shop;\s*/i, '');

    // 按分号分割并逐个执行（跳过空语句）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // 重新组装带分号的语句
    // 更好的方式：按语句块分割
    const blocks = sql
      .replace(/--.*$/gm, '')      // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of blocks) {
      try {
        const [result] = await connection.query(stmt);
        if (result && result.warningStatus === 0) {
          // 无警告，正常执行
        }
      } catch (err) {
        // CREATE TABLE IF NOT EXISTS 可能报 warning，继续
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  表已存在，跳过: ${stmt.substring(0, 50)}...`);
        } else {
          console.log(`⚠️  ${err.message} (语句: ${stmt.substring(0, 60)}...)`);
        }
      }
    }

    console.log('✅ 数据库表结构创建完成');
    console.log('✅ 初始数据插入完成');
    console.log('');
    console.log('📊 数据库 chase_shop 已就绪，包含以下表：');
    const [tables] = await connection.query('SHOW TABLES');
    tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));

    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ 初始化失败:', err.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

initDatabase();