# 🌙 Lịch Việt – Âm dương lịch & Đếm ngược sự kiện

Ứng dụng web xem lịch Dương/Âm, quản lý sự kiện (ngày giỗ, ngày cưới, kỷ niệm, sinh nhật...), đếm ngược thời gian thực,
lưu dữ liệu lên **Google Sheet** và gửi **email cảnh báo** tự động. Tối ưu cho điện thoại.

## ✨ Tính năng
- 📅 Lịch tháng hiển thị song song ngày dương & âm, can chi, tiết khí, giờ hoàng đạo, ngày lễ VN. Vuốt trái/phải để đổi tháng.
- 🏷️ Loại sự kiện tuỳ biến (icon, màu): Ngày giỗ, Ngày cưới, Kỷ niệm, Sinh nhật, Ngày lễ, Công việc, Khác...
- ➕ Sự kiện: tên, ngày (dương **hoặc âm**, có tháng nhuận), giờ, lặp lại (hằng năm / hằng tháng / một lần), mốc nhắc, email, ghi chú.
- ⏳ Màn hình chính: đồng hồ, ngày âm hôm nay, đếm ngược ngày-giờ-phút-giây tới sự kiện gần nhất + danh sách sắp diễn ra. Tự tính "giỗ lần thứ N" / "năm thứ N".
- ☁️ Đồng bộ Google Sheet qua Apps Script (vẫn chạy offline bằng localStorage).
- 🔔 Cảnh báo:
  - **Email hằng ngày 7h sáng** (Apps Script trigger) theo mốc: **trước 3 ngày, 2 ngày, 1 ngày và đúng ngày** (mặc định, tuỳ chỉnh thêm 7 ngày) – chạy kể cả khi không mở app. Gộp nhiều sự kiện vào 1 email, không gửi trùng (sheet `NotifyLog`).
  - **Thông báo trình duyệt** khi app đang mở (đúng ngày: báo trước giờ sự kiện 1 tiếng).
- 🌗 Tự động Dark mode.

## 🚀 Chạy local
```bash
npm install
npm run dev
```

## ☁️ Cấu hình Google Sheet + Email
1. Tạo Google Sheet mới → **Tiện ích mở rộng → Apps Script**.
2. Dán nội dung [`apps-script/Code.gs`](apps-script/Code.gs) vào, lưu.
3. **Project Settings** → Time zone: `(GMT+07:00) Asia/Ho_Chi_Minh`.
4. Chọn hàm `setup` → **Run** → cấp quyền (tạo sheet `Events`, `Types`, `NotifyLog` và trigger 7h sáng).
5. **Deploy → New deployment → Web app**: *Execute as: Me*, *Who has access: Anyone* → copy URL `.../exec`.
6. Mở app → **Cài đặt** → dán URL → *Lưu & kết nối*. Nhập email → *Gửi thử*.
   - Nếu đã có dữ liệu offline, bấm *Đẩy lên Sheet*.
   - Muốn mọi thiết bị dùng chung mà không cần nhập: điền URL vào `DEFAULT_SHEET_URL` trong `src/lib/storage.ts`.

> Sau khi sửa `Code.gs`, phải **Deploy → Manage deployments → Edit → New version** thì Web App mới cập nhật.

> ⚠️ Web App để "Anyone" nghĩa là ai có URL đều đọc/ghi được. Đừng chia sẻ URL công khai.

## 🌐 Deploy GitHub Pages
1. Tạo repo GitHub tên `calendar` (nếu tên khác, sửa `base` trong `vite.config.ts` thành `/<tên-repo>/`).
2. Push code lên nhánh `main`:
   ```bash
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<user>/calendar.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages → Source: GitHub Actions**. Workflow `.github/workflows/deploy.yml` sẽ build & deploy.
4. Truy cập `https://<user>.github.io/calendar/`. Trên điện thoại: *Thêm vào màn hình chính* để dùng như app.

## 🗂️ Cấu trúc
```
src/
  lib/lunar.ts        Thuật toán âm lịch (Hồ Ngọc Đức), can chi, tiết khí, giờ hoàng đạo
  lib/events.ts       Model sự kiện, tính lần diễn ra kế tiếp (dương/âm, lặp lại)
  lib/storage.ts      localStorage + API Google Apps Script
  lib/notify.ts       Thông báo trình duyệt
  components/         HomeView, CalendarView, EventList, EventForm, SettingsView
apps-script/Code.gs   Backend Google Sheet + gửi email cảnh báo
```
