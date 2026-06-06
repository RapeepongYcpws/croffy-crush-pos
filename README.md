# croffy-crush POS

ระบบ POS สำหรับร้านขนมครอฟเฟิล **croffy-crush**
- **Frontend:** Next.js 14 (App Router) + TypeScript + TailwindCSS + lucide-react
- **Backend:** Go (net/http stdlib router) + JWT auth
- **Database:** MySQL 8

## โครงสร้างโปรเจกต์

```
inernal/
├── database/
│   └── schema.sql          # MySQL schema + seed + ตัวอย่าง query
├── backend/                # Go API
│   ├── cmd/server          # main entrypoint
│   ├── cmd/seedadmin       # สร้าง user admin
│   └── internal/           # config, db, auth, middleware, handlers, models
└── frontend/               # Next.js app
    └── src/
        ├── app/            # routes (login, (app)/dashboard, ...)
        ├── components/     # AppShell (เมนูบน+hamburger), AuthGuard
        └── lib/            # api client, auth context, nav config
```

## การติดตั้ง / รัน

### 1) Database
```bash
mysql -u root -p < database/schema.sql
```

ถ้าไม่มี `mysql` CLI ให้ใช้ migration command ของแอป (อ่าน `database/schema.sql`
แล้ว apply ผ่าน connection เดียวกับ backend — idempotent ใช้ `CREATE TABLE IF NOT EXISTS`):
```bash
cd backend && cp .env.example .env   # ตั้งค่า DB ให้ถูกก่อน
go run ./cmd/migrate
```

### 2) Backend
```bash
cd backend
cp .env.example .env          # แก้ค่า DB / JWT_SECRET ตามจริง
go mod download
go run ./cmd/seedadmin        # สร้าง admin / admin123
go run ./cmd/server           # API ที่ http://localhost:8080
```

### 3) Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

เข้าสู่ระบบด้วย `admin / admin123` (เปลี่ยนรหัสผ่านทันทีหลังใช้งานจริง)

## สถานะการพัฒนา

ทำเสร็จครบทุก feature ตาม requirement:
- ระบบ login + JWT + route guard ทุกหน้า (redirect ไป `/login`)
- Layout เมนูแถวบน + ปุ่มแฮมเบอร์เกอร์ + ชื่อร้าน `croffy-crush` · responsive ทุก device
- Dashboard ภาพรวมวันนี้ (ยอดขาย/จำนวนออเดอร์/คิวครัว/เมนูขายดี)
- จัดการเมนู (CRUD: ชื่อ ราคา รูปภาพ คำอธิบาย)
- หน้า order: เลือกเมนู + add-on topping + dine-in/takeaway + popup ยืนยัน
- หน้าครัว: แสดงออเดอร์ที่เข้ามา + กด "เสร็จแล้ว" อัปเดตสถานะ (auto refresh)
- หน้าจ่ายเงิน: เลือก QR PromptPay (payload จาก backend, ไม่ระบุจำนวนเงิน) หรือเงินสด
- สะสมคะแนน: QR หมดอายุ 5 นาที ใช้ครั้งเดียว, validate เบอร์ไทย, 1 บาท = 10 คะแนน
- หน้าขอบคุณ + แสดงคะแนน + popup แลกของรางวัล (disable รายการที่คะแนนไม่พอ)
- จัดการรางวัล (CRUD)
- รายงานรายวัน/สัปดาห์/เดือน + เมนูที่ขายได้ + ยอดรวม
- ค้นหาออเดอร์ตามวันที่ (ตาราง) + หน้ารายละเอียด + admin ใส่เบอร์ย้อนหลังได้ (ถ้า token ยังไม่หมดอายุ)

## API
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| GET   | `/api/health`                    | -   | health check |
| POST  | `/api/auth/login`                | -   | login → JWT |
| GET   | `/api/auth/me`                   | ✓   | user ปัจจุบัน |
| GET   | `/api/dashboard/summary`         | ✓   | ภาพรวมวันนี้ |
| GET   | `/api/menu-items`                | ✓   | รายการเมนู (`?active=1`) |
| POST  | `/api/menu-items`                | ✓   | เพิ่มเมนู |
| PUT   | `/api/menu-items/{id}`           | ✓   | แก้ไขเมนู |
| DELETE| `/api/menu-items/{id}`           | ✓   | ลบเมนู |
| GET   | `/api/addons`                    | ✓   | รายการ add-on |
| POST  | `/api/orders`                    | ✓   | สร้างออเดอร์ |
| GET   | `/api/orders/kitchen`            | ✓   | คิวครัว |
| GET   | `/api/orders/search?date=`       | ✓   | ค้นหาตามวันที่ |
| GET   | `/api/orders/{id}`               | ✓   | รายละเอียดออเดอร์ |
| PATCH | `/api/orders/{id}/status`        | ✓   | อัปเดตสถานะ (done) |
| GET   | `/api/orders/{id}/qr`            | ✓   | PromptPay payload |
| POST  | `/api/orders/{id}/pay`           | ✓   | ชำระเงิน + ออก loyalty token |
| POST  | `/api/orders/{id}/loyalty/claim` | ✓   | admin ใส่เบอร์ย้อนหลัง |
| GET   | `/api/loyalty/{token}`           | -   | validate token สะสมคะแนน |
| POST  | `/api/loyalty/{token}/claim`     | -   | ลูกค้าใส่เบอร์รับคะแนน |
| GET   | `/api/rewards/available?points=` | -   | รางวัลที่แลกได้ |
| POST  | `/api/rewards/redeem`            | -   | แลกรางวัล |
| GET   | `/api/rewards`                   | ✓   | รายการรางวัล (จัดการ) |
| POST  | `/api/rewards`                   | ✓   | เพิ่มรางวัล |
| PUT   | `/api/rewards/{id}`              | ✓   | แก้ไขรางวัล |
| DELETE| `/api/rewards/{id}`              | ✓   | ลบรางวัล |
| GET   | `/api/reports?period=`           | ✓   | รายงาน daily/weekly/monthly |

## หมายเหตุ PromptPay
ตั้งค่าเบอร์/เลขผู้รับเงินได้ในตาราง `app_settings` (key `promptpay_id`) หรือ env `PROMPTPAY_ID`
backend สร้าง payload มาตรฐาน EMVCo (static, ไม่ระบุจำนวนเงิน) แล้ว frontend render เป็น QR
