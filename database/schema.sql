-- ============================================================
-- croffy-crush POS — MySQL Schema
-- Charset: utf8mb4 (รองรับภาษาไทย/emoji)
-- ============================================================

CREATE DATABASE IF NOT EXISTS croffy_crush
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE croffy_crush;

-- ------------------------------------------------------------
-- 1) Users (พนักงาน/แอดมิน) สำหรับระบบ login
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(128) NULL,
  role          ENUM('admin','cashier','kitchen') NOT NULL DEFAULT 'cashier',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2) Menu items (จัดการเมนู)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(128)   NOT NULL,
  description TEXT           NULL,
  price       DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  image_url   MEDIUMTEXT     NULL,
  category    VARCHAR(64)    NULL,
  is_active   TINYINT(1)     NOT NULL DEFAULT 1,
  display_order INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_menu_active (is_active),
  KEY idx_menu_order (display_order)
) ENGINE=InnoDB;

-- Migration for existing databases (run once):
--   ALTER TABLE menu_items ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER is_active;
--   ALTER TABLE menu_items ADD KEY idx_menu_order (display_order);
--   UPDATE menu_items SET display_order = id;
--   ALTER TABLE menu_items MODIFY COLUMN image_url MEDIUMTEXT NULL;  -- store uploaded image as base64 data URL

-- ------------------------------------------------------------
-- 3) Add-on / Topping (ตัวเลือกเสริม)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addons (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(128)  NOT NULL,
  price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active  TINYINT(1)    NOT NULL DEFAULT 1,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- (optional) จำกัด add-on ที่ใช้ได้กับเมนูบางตัว
CREATE TABLE IF NOT EXISTS menu_item_addons (
  menu_item_id BIGINT UNSIGNED NOT NULL,
  addon_id     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (menu_item_id, addon_id),
  CONSTRAINT fk_mia_menu  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_mia_addon FOREIGN KEY (addon_id)     REFERENCES addons(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4) Customers (ลูกค้าสะสมคะแนน) — ใช้เบอร์โทรเป็น key
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone        VARCHAR(20)  NOT NULL,           -- format ไทย เช่น 0812345678
  name         VARCHAR(128) NULL,
  total_points INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_phone (phone)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5) Orders (ออเดอร์หลัก)
--    status flow: pending -> in_kitchen -> done
--    payment: unpaid -> paid
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(32)    NOT NULL,                 -- เช่น 20260531-0001
  order_type      ENUM('dine_in','takeaway') NOT NULL DEFAULT 'dine_in',
  status          ENUM('pending','in_kitchen','done','cancelled') NOT NULL DEFAULT 'pending',
  payment_status  ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  payment_method  ENUM('qr','cash') NULL,
  subtotal        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  discount        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  total           DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  customer_id     BIGINT UNSIGNED NULL,                    -- null = ยังไม่สะสมคะแนน
  created_by      BIGINT UNSIGNED NULL,                    -- user (พนักงาน) ที่สร้าง
  paid_at         TIMESTAMP      NULL,
  completed_at    TIMESTAMP      NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at),
  KEY idx_orders_customer (customer_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_user     FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6) Order items (รายการในออเดอร์)
--    เก็บ snapshot ชื่อ/ราคา ณ เวลาขาย เผื่อเมนูเปลี่ยนทีหลัง
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id      BIGINT UNSIGNED NOT NULL,
  menu_item_id  BIGINT UNSIGNED NULL,
  item_name     VARCHAR(128)  NOT NULL,        -- snapshot
  unit_price    DECIMAL(10,2) NOT NULL,        -- snapshot ราคาเมนู (ไม่รวม add-on)
  quantity      INT           NOT NULL DEFAULT 1,
  addons_total  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  line_total    DECIMAL(10,2) NOT NULL DEFAULT 0.00,  -- (unit_price + addons_total) * quantity
  note          VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  KEY idx_oi_order (order_id),
  KEY idx_oi_menu (menu_item_id),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id)     REFERENCES orders(id)     ON DELETE CASCADE,
  CONSTRAINT fk_oi_menu  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7) Order item add-ons (snapshot add-on ของแต่ละรายการ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_item_addons (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_item_id BIGINT UNSIGNED NOT NULL,
  addon_id      BIGINT UNSIGNED NULL,
  addon_name    VARCHAR(128)  NOT NULL,    -- snapshot
  price         DECIMAL(10,2) NOT NULL,    -- snapshot
  PRIMARY KEY (id),
  KEY idx_oia_item (order_item_id),
  CONSTRAINT fk_oia_item  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_oia_addon FOREIGN KEY (addon_id)      REFERENCES addons(id)      ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8) Payments (บันทึกการชำระเงิน) — รองรับหลายครั้งในอนาคต
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    BIGINT UNSIGNED NOT NULL,
  method      ENUM('qr','cash') NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  qr_payload  TEXT          NULL,            -- PromptPay payload ที่ generate
  status      ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  paid_at     TIMESTAMP     NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pay_order (order_id),
  CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9) Loyalty tokens (QR สะสมคะแนน) — expire 5 นาที, ใช้ครั้งเดียว
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token       CHAR(36)     NOT NULL,          -- UUID
  order_id    BIGINT UNSIGNED NOT NULL,
  points      INT          NOT NULL DEFAULT 0, -- คะแนนที่จะได้ (1 บาท = 10 คะแนน)
  expires_at  TIMESTAMP    NOT NULL,
  used_at     TIMESTAMP    NULL,               -- null = ยังไม่ถูกใช้
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token),
  KEY idx_lt_order (order_id),
  CONSTRAINT fk_lt_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10) Point transactions (ประวัติคะแนน earn/redeem)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS point_transactions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_id    BIGINT UNSIGNED NULL,
  type        ENUM('earn','redeem','adjust') NOT NULL,
  points      INT          NOT NULL,          -- +earn / -redeem
  note        VARCHAR(255) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pt_customer (customer_id),
  CONSTRAINT fk_pt_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_order    FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11) Rewards (ของรางวัล) + การแลก
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rewards (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(128) NOT NULL,
  description TEXT         NULL,
  points_cost INT          NOT NULL,
  image_url   VARCHAR(512) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rewards_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  reward_id   BIGINT UNSIGNED NULL,
  reward_name VARCHAR(128) NOT NULL,    -- snapshot
  points_used INT          NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rr_customer (customer_id),
  CONSTRAINT fk_rr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_rr_reward   FOREIGN KEY (reward_id)   REFERENCES rewards(id)   ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 12) App settings (เก็บ PromptPay payload / config ต่างๆ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(64)  NOT NULL,
  setting_value TEXT         NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

-- ============================================================
-- Seed data เริ่มต้น
-- ============================================================

-- หมายเหตุ: สร้าง user admin ด้วยคำสั่ง `go run ./cmd/seedadmin` ในโฟลเดอร์ backend
-- (จะ hash รหัสผ่านด้วย bcrypt ให้อัตโนมัติ) — ดู README

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('promptpay_id', '0812345678'),            -- เบอร์/เลขผู้รับ PromptPay (แก้ในหน้า setting)
  ('thaiqr_payload', '00020101021130860016A000000677010112011501075370008820502198B120940Y31033427TS0320MISSPHATSAKANLAIPHAI53037645802TH62080704000063045D8E'), -- Thai QR ถุงเงิน (ค่า default ตอนชำระเงิน)
  ('points_per_baht', '10'),                  -- 1 บาท = 10 คะแนน
  ('loyalty_token_ttl_seconds', '300')        -- QR สะสมคะแนน expire 5 นาที
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO addons (name, price) VALUES
  ('Nutella', 25.00),
  ('Whipped Cream', 15.00),
  ('Strawberry', 20.00),
  ('Ice Cream', 30.00)
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO menu_items (name, description, price, category) VALUES
  ('Original Croffle', 'ครอฟเฟิลเนยสดสูตรต้นตำรับ', 59.00, 'croffle'),
  ('Chocolate Croffle', 'ครอฟเฟิลราดช็อกโกแลตเข้มข้น', 79.00, 'croffle'),
  ('Matcha Croffle', 'ครอฟเฟิลมัทฉะ', 85.00, 'croffle')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO rewards (name, description, points_cost) VALUES
  ('ส่วนลด 20 บาท', 'ใช้เป็นส่วนลดมูลค่า 20 บาท', 500),
  ('Croffle ฟรี 1 ชิ้น', 'แลก Original Croffle ฟรี', 1500),
  ('เครื่องดื่มฟรี', 'แลกเครื่องดื่ม 1 แก้ว', 1000)
ON DUPLICATE KEY UPDATE name = name;

-- ============================================================
-- ตัวอย่าง Query สำหรับ Dashboard & Report
-- ============================================================

-- [Dashboard] ยอดขาย + จำนวนออเดอร์ของวันนี้ (เฉพาะที่จ่ายแล้ว)
-- SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS sales
-- FROM orders
-- WHERE payment_status = 'paid' AND DATE(created_at) = CURDATE();

-- [Dashboard] รายการที่ค้างในครัว
-- SELECT * FROM orders WHERE status IN ('pending','in_kitchen') ORDER BY created_at ASC;

-- [Dashboard] เมนูขายดีของวันนี้
-- SELECT oi.item_name, SUM(oi.quantity) AS qty
-- FROM order_items oi
-- JOIN orders o ON o.id = oi.order_id
-- WHERE DATE(o.created_at) = CURDATE() AND o.payment_status = 'paid'
-- GROUP BY oi.item_name ORDER BY qty DESC LIMIT 5;

-- [Report รายวัน] ยอดขายรวมต่อวัน
-- SELECT DATE(created_at) AS day, COUNT(*) AS orders, SUM(total) AS sales
-- FROM orders WHERE payment_status='paid'
-- GROUP BY DATE(created_at) ORDER BY day DESC;

-- [Report รายสัปดาห์]
-- SELECT YEARWEEK(created_at, 3) AS yw, COUNT(*) AS orders, SUM(total) AS sales
-- FROM orders WHERE payment_status='paid'
-- GROUP BY YEARWEEK(created_at, 3) ORDER BY yw DESC;

-- [Report รายเดือน]
-- SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS orders, SUM(total) AS sales
-- FROM orders WHERE payment_status='paid'
-- GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC;

-- [ค้นหาออเดอร์ตามวันที่]
-- SELECT * FROM orders WHERE DATE(created_at) = ? ORDER BY created_at DESC;
