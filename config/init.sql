-- ==========================================
-- 智慧农业电商平台 - 数据库初始化脚本
-- ==========================================

USE chase_shop;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
  password VARCHAR(255) NOT NULL COMMENT '加密密码',
  name VARCHAR(50) DEFAULT '' COMMENT '昵称',
  avatar VARCHAR(500) DEFAULT '' COMMENT '头像URL',
  role ENUM('user', 'admin') DEFAULT 'user' COMMENT '角色',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 商品分类表
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL COMMENT '分类名称',
  icon VARCHAR(255) DEFAULT '' COMMENT '图标',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表';

-- 3. 商品表
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL COMMENT '商品名称',
  description TEXT COMMENT '商品描述',
  price DECIMAL(10,2) NOT NULL COMMENT '售价',
  original_price DECIMAL(10,2) DEFAULT NULL COMMENT '原价',
  stock INT DEFAULT 0 COMMENT '库存',
  image VARCHAR(500) DEFAULT '' COMMENT '主图URL',
  images JSON DEFAULT NULL COMMENT '多图JSON数组',
  category_id INT DEFAULT NULL COMMENT '分类ID',
  badge VARCHAR(50) DEFAULT '' COMMENT '角标（如：热卖、新品）',
  weight VARCHAR(30) DEFAULT '' COMMENT '规格重量',
  specs TEXT COMMENT '规格说明（换行分隔）',
  is_featured TINYINT(1) DEFAULT 0 COMMENT '是否推荐',
  is_on_sale TINYINT(1) DEFAULT 1 COMMENT '是否上架',
  sales INT DEFAULT 0 COMMENT '销量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- 4. 收货地址表
CREATE TABLE IF NOT EXISTS addresses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  receiver_name VARCHAR(50) NOT NULL COMMENT '收货人',
  receiver_phone VARCHAR(20) NOT NULL COMMENT '收货电话',
  province VARCHAR(50) NOT NULL COMMENT '省',
  city VARCHAR(50) NOT NULL COMMENT '市',
  district VARCHAR(50) NOT NULL COMMENT '区',
  detail VARCHAR(200) NOT NULL COMMENT '详细地址',
  is_default TINYINT(1) DEFAULT 0 COMMENT '是否默认',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货地址表';

-- 5. 购物车表
CREATE TABLE IF NOT EXISTS cart_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  product_id INT NOT NULL COMMENT '商品ID',
  quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_product (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车表';

-- 6. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  order_no VARCHAR(30) NOT NULL UNIQUE COMMENT '订单号',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  status ENUM('pending', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'refunding', 'refunded') DEFAULT 'pending' COMMENT '订单状态',
  receiver_name VARCHAR(50) NOT NULL COMMENT '收货人',
  receiver_phone VARCHAR(20) NOT NULL COMMENT '收货电话',
  receiver_address VARCHAR(300) NOT NULL COMMENT '收货地址',
  remark VARCHAR(500) DEFAULT '' COMMENT '备注',
  paid_at TIMESTAMP NULL COMMENT '支付时间',
  shipped_at TIMESTAMP NULL COMMENT '发货时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- 7. 订单明细表
CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  product_id INT NOT NULL COMMENT '商品ID',
  product_name VARCHAR(200) NOT NULL COMMENT '商品名称（快照）',
  product_image VARCHAR(500) DEFAULT '' COMMENT '商品图片（快照）',
  product_price DECIMAL(10,2) NOT NULL COMMENT '下单时单价',
  quantity INT NOT NULL COMMENT '数量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

-- 8. 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '订单ID',
  payment_no VARCHAR(50) NOT NULL COMMENT '支付流水号',
  amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
  method ENUM('wechat', 'alipay') DEFAULT 'wechat' COMMENT '支付方式',
  status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付记录表';

-- ==========================================
-- 初始数据：分类
-- ==========================================
INSERT INTO categories (name, icon, sort_order) VALUES
('时令水果', '🍑', 1),
('精品蔬菜', '🥬', 2),
('粮油干货', '🌾', 3),
('禽蛋肉类', '🥚', 4);

-- ==========================================
-- 初始数据：商品
-- ==========================================
INSERT INTO products (name, description, price, original_price, stock, image, category_id, badge, weight, specs, is_featured, is_on_sale) VALUES
('精品杨梅 3斤装', '余姚当季杨梅，当天清晨采摘，单果12g+，冰袋+泡沫箱保鲜包装', 89.00, 108.00, 999, '/images/project-1-thumb.jpg', 1, '家庭尝鲜', '3斤/箱', '精选大果·单果12g+\n当天清晨采摘\n冰袋+泡沫箱保鲜包装\n江浙沪次日达', 1, 1),
('甄选礼盒 5斤装', '特选大果杨梅，单果15g+，品牌礼盒送礼体面，产地溯源二维码', 158.00, 198.00, 500, '/images/project-2-thumb.jpg', 1, '送礼推荐', '5斤/箱', '特选大果·单果15g+\n品牌礼盒·送礼体面\n产地溯源二维码\n顺丰冷链配送', 1, 1),
('有机大米 10斤装', '东北五常稻花香，有机认证，颗粒饱满香甜软糯', 49.00, 65.00, 300, '/images/project-3-thumb.jpg', 3, '热卖', '10斤/袋', '五常稻花香2号\n有机认证\n真空包装', 1, 1),
('农家土鸡蛋 30枚装', '林间散养土鸡蛋，蛋黄饱满，无抗生素无激素', 45.00, 52.00, 200, '/images/project-4-thumb.jpg', 4, '新品', '30枚/箱', '林间散养\n蛋黄橙黄饱满\n珍珠棉防震包装', 1, 1),
('有机蔬菜礼盒 8斤装', '当天采摘时令有机蔬菜8种搭配，健康新鲜直达', 68.00, 88.00, 150, '/images/project-5-thumb.jpg', 2, '推荐', '8斤/箱', '8种时令搭配\n有机认证\n冷链保鲜', 1, 1),
('杨梅汁 6瓶装', '鲜榨杨梅汁，原汁原味无添加，冰镇更美味', 36.00, 42.00, 600, '/images/project-6-thumb.jpg', 1, '热卖', '6瓶/箱', '330ml/瓶\nNFC鲜榨工艺\n冷藏口感更佳', 0, 1);