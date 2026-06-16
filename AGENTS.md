# Image Background Remover (Xoá Phông Ảnh)

Dự án này là một ứng dụng web xử lý hình ảnh trực tiếp trên trình duyệt, cho phép người dùng xoá màu nền, cắt ảnh và xuất ra định dạng trong suốt (PNG/WebP) với hiệu suất cực cao.

## Công nghệ sử dụng
- **Ngôn ngữ:** Thuần JavaScript (Vanilla JS), HTML5, CSS3.
- **Xử lý ảnh:** HTML5 Canvas API.
- **Đa luồng:** Web Workers (xử lý pixel mượt mà).
- **Icons:** SVG nội tuyến trong `index.html` (paths từ bộ Lucide, giấy phép ISC). Không còn dùng thư viện Lucide/CDN.
- **Không phụ thuộc vào framework (React/Vue/Angular) hay trình biên dịch (Vite/Webpack).**

## Kiến trúc dự án
- `index.html`: Cấu trúc trang web.
- `script.js`: Quản lý giao diện, trạng thái Crop, Zoom, và điều phối thao tác người dùng (Vanilla JS). Được bọc trong `DOMContentLoaded` để đảm bảo an toàn.
- `worker.js`: Xử lý pixel ở luồng riêng theo pipeline: (1) phân loại nền theo khoảng cách màu (`<= toleranceSq`), (2) flood-fill từ mép nếu bật, (3) tạo alpha nhị phân, (4) erode (shrink), (5) box-blur alpha (feather), (6) ghi alpha + despill (decontamination `FG=(px-(1-a)·BG)/a`). Tham số: `tolerance, feather, shrink, despill, floodFill`.
- `style.css`: Quản lý styling và các điều khiển crop.
- `sw.js`: Service worker, cache-first cho tài nguyên cùng origin (offline). **Khi đổi danh sách file tĩnh hoặc cần ép cập nhật, hãy tăng `CACHE` version (`rmbg-v1` → `v2`…).**
- `manifest.webmanifest`: Khai báo PWA. SEO meta (description/OG/Twitter) nằm trong `<head>` của `index.html`.

## Các lưu ý kỹ thuật quan trọng
1. **DOM Access:** Luôn truy cập phần tử bên trong `DOMContentLoaded`. Icon là SVG nội tuyến sẵn trong HTML (không cần khởi tạo runtime).
2. **Performance (Canvas):** 
   - Tuyệt đối không sử dụng `toDataURL()` trong các vòng lặp hoặc sự kiện di chuyển chuột. Hãy dùng Canvas context trực tiếp.
   - Luôn khởi tạo context với tuỳ chọn `{ willReadFrequently: true }` khi có sử dụng `getImageData` hoặc `putImageData` nhiều lần (ví dụ: `getContext('2d', { willReadFrequently: true })`). Điều này giúp trình duyệt tối ưu hoá bộ nhớ (software RAM thay vì GPU) để đọc pixel nhanh hơn.
3. **Crop Logic:** Tọa độ Crop được tính toán dựa trên tỉ lệ scale giữa kích thước hiển thị và kích thước thực tế của Canvas.
4. **File Handling:** Tên file gốc được lưu trong `state.originalFileName` để phục vụ lúc download.
5. **Kính lúp & chọn màu:** Kính lúp (`#magnifier`) LUÔN hiện khi rê chuột trên canvas để quan sát. Việc click-lấy-màu chỉ chạy khi `state.pickMode` bật (nút Pipette toggle, con trỏ crosshair + tâm ngắm `.magnifier::after`). Đã bỏ `EyeDropper` API, dùng picker trong ảnh.

## Design system (style.css)
- **Dùng lại CSS variables — không hardcode.** Mọi màu accent và khoảng cách phải tham chiếu biến trong `:root`:
  - Màu: `--accent` (`#c3002f`), `--accent-2` (`#ff4d4f`), `--accent-grad` (gradient 135°), `--accent-soft`. Theo bộ màu của js-tools.org.
  - Thang size: `--size-level-0`…`--size-level-5` = 0 / 4 / 8 / 16 / 32 / 64px. Áp dụng cho `gap`, `padding`, `margin`, `border-radius`. Khi thêm spacing/radius mới hãy quy về thang này.
- **Layout cố định, không cuộn:** `html, body` và `.app-container` đặt `overflow: hidden`, `body` dùng `position: fixed; inset: 0`. Nội dung phải vừa viewport — đừng thêm phần tử khiến tràn gây scroll.
- **Bảng controls** thiết kế dày đặc kiểu Photoshop (rộng cố định, label viết HOA nhỏ, phân tách bằng `border-bottom`); panel không scroll nên giữ các control gọn.
- **Vùng preview** dùng nền xám trơn (`#9aa0a6`), không còn ô caro.
