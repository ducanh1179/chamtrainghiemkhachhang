# Web chấm trải nghiệm khách hàng (BHX HCM)

Chỉ có một phiên bản dữ liệu là web. Chấm, báo cáo và xuất Excel đều làm trên web; không đồng bộ về Google Sheet.

## Cách hệ thống chạy

```
Điện thoại QLST/QLTP/RSM ──► Firebase (Firestore: lượt chấm · Storage: ảnh) ──► Tab Kết quả / Xuất CSV
Sheet PHÂN BỔ + CAU_HINH_WEB ──(22h, Apps Script)──► danh sách shop + ngày mốc trên web
```

- **QLST:** mỗi shop 1 lượt/ngày. Được sửa trong 10 phút, sau đó máy chủ khoá cứng.
- **QLTP/RSM:** chấm không giới hạn số lượt, ghi riêng.
- **LIỆT:** QLST chấm hằng ngày hoặc camera thì câu LIỆT bị lỗi **vẫn trừ điểm** nhưng lượt chấm không xếp LIỆT. LIỆT chỉ ghi nhận khi QLTP/RSM chấm hoặc khi chấm chéo.
- **Lỗi lặp lại:** cùng một tiêu chí lỗi từ 3 ngày trở lên trong tháng thì cảnh báo. QLTP/RSM chấm lại chọn "Không lỗi" thì cảnh báo được gỡ.
- **Tự dọn sau 45 ngày** (không cần script):
  - Lượt chấm có trường `hetHan` sẽ bị Firestore TTL tự xoá.
  - Lượt LIỆT hoặc dưới 45đ không có `hetHan`, nên được giữ lâu dài.
  - Ảnh nằm ở `tam/` bị xoá sau 45 ngày nhờ quy tắc Lifecycle. Ảnh của lượt LIỆT hoặc dưới 45đ được chép sang `giu/` và giữ lâu dài.
- **Mạng yếu:** lượt chấm lưu trên máy và tự gửi khi có mạng.

## Cài đặt (làm 1 lần)

### A. Firebase
1. Vào https://console.firebase.google.com → **Add project** → đặt tên (ví dụ `cham-tnkh`) → tắt Google Analytics.
2. Bấm **Upgrade** → gói **Blaze** → gắn thẻ. Đặt *Budget alert* khoảng 2 USD/tháng.
3. **Authentication** → Get started → *Sign-in method* → **Anonymous** → Enable.
   Sau đó vào **Settings → Authorized domains** → thêm `ducanh1179.github.io`.
4. **Firestore Database** → Create database → vùng **asia-southeast1 (Singapore)** → Production mode.
   - Tab **Rules**: dán `firestore.rules` → Publish.
   - Tab **TTL** (Time-to-live): tạo 3 chính sách, mỗi chính sách là collection group + trường `hetHan`: `qlst`, `kt`, `thang`.
5. **Storage** → Get started.
   - Tab **Rules**: dán `storage.rules` → Publish.
   - Mở https://console.cloud.google.com/storage → chọn bucket của dự án → tab **Lifecycle** → **Add a rule**:
     - Action: **Delete object**
     - Điều kiện: **Age = 45 ngày** và **Object name matches prefix = `tam/`**
6. **Project settings → Your apps → `</>`** → Register. Chép đoạn `firebaseConfig` và điền vào `firebase-config.js` (hoặc gửi Claude điền).

### B. Apps Script cập nhật danh sách shop (chỉ đọc Sheet, 1 lần/ngày)
1. Mở file **HCM PHÂN BỔ** → *Tiện ích mở rộng → Apps Script*.
2. Dán `apps-script/Code.gs` và sửa `PROJECT_ID`.
3. Mở *Cài đặt dự án* → tick hiển thị `appsscript.json` → dán nội dung `apps-script/appsscript.json`.
4. Chạy `setupTriggers` → cấp quyền → chạy `syncShops`. Tài khoản chạy phải là **chủ dự án Firebase**.
5. Sheet **CAU_HINH_WEB** được tạo trong file PHÂN BỔ, dùng để sửa ngày mốc từng tháng (tháng 10: 16/10, tháng 11: 01/11).
   Muốn áp dụng ngay thì chạy menu *Web chấm → Cập nhật*, không thì web tự lấy lúc 22h.

## Xuất dữ liệu
Vào tab **Kết quả → Xuất dữ liệu ra Excel (CSV)**:
- **Chi tiết từng lượt:** C01–C26, ghi chú, link ảnh. Tối đa 31 ngày mỗi lần.
- **Danh sách lỗi:** 1 dòng/lỗi, kèm link ảnh.
- **Tổng hợp tháng theo shop:** tính theo ngày mốc. Gồm % QLST chấm, điểm TB, số lượt QLTP, số lượt LIỆT, cảnh báo lặp lại.

Bộ lọc RSM/QLTP đang chọn được áp dụng cho file xuất.
