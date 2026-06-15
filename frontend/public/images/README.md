# Images

วางไฟล์รูปภาพ static ของโปรเจกต์ไว้ในโฟลเดอร์นี้ (`frontend/public/images/`)

## วิธีใช้งาน

ไฟล์ใน `public/` จะถูกเสิร์ฟที่ root path โดยตัด `public/` ออก เช่น:

- ไฟล์: `public/images/logo.png`
- URL: `/images/logo.png`

### ตัวอย่างใน component

```tsx
import Image from "next/image";

<Image src="/images/logo.png" alt="Croffy Crush" width={120} height={120} />
```

หรือใช้ `<img>` ปกติ:

```tsx
<img src="/images/logo.png" alt="Croffy Crush" />
```

> หมายเหตุ: อ้างอิงด้วย path `/images/...` เสมอ (ขึ้นต้นด้วย `/`) ไม่ต้องใส่ `public/`
