# Image Background Remover (Xoá Phông Ảnh)

Ứng dụng web đơn giản, mạnh mẽ cho phép xoá màu nền hình ảnh trực tiếp trên trình duyệt.

## 🚀 Tính năng nổi bật
- **Xoá phông mượt mà:** Khoảng cách màu Euclid + các tinh chỉnh viền:
  - **Làm mịn cạnh (Feather):** làm mờ alpha theo không gian cho viền tự nhiên.
  - **Co mặt nạ (Shrink):** erode chủ thể để ăn bớt viền nền còn sót.
  - **Khử viền màu (Despill):** decontamination khử ám màu nền ở pixel bán trong suốt.
  - **Chỉ xoá nền nối từ mép (Flood-fill):** giữ lại vùng cùng màu nằm bên trong chủ thể.
- **Hiệu năng cao:** Xử lý ảnh qua **Web Worker**, đảm bảo giao diện luôn mượt mà kể cả khi xử lý ảnh lớn.
- **Cắt ảnh chuyên nghiệp:** Công cụ Crop tích hợp với 8 nút nắm resize và hiển thị kích thước thực tế.
- **Kính lúp soi chi tiết:** Luôn phóng to 3x tại vị trí chuột để quan sát viền ảnh, kèm tâm ngắm khi chọn màu.
- **Công cụ chọn màu (Pipette):** Bật chế độ Pipette rồi nhấp trực tiếp vào ảnh để lấy màu nền cần xoá (kính lúp + tâm ngắm giúp chọn chính xác).
- **Hỗ trợ đa định dạng:** Chấp nhận mọi loại ảnh đầu vào, xuất file **PNG** hoặc **WebP** giữ nguyên tên file gốc.
- **Giao diện gọn gàng:** Bố cục cố định toàn màn hình (không cuộn trang), bảng điều khiển dày đặc kiểu settings của Photoshop.

## 🎨 Giao diện
- **Bảng màu:** Theo bộ màu đỏ của [js-tools.org](https://js-tools.org/) (`#c3002f` → `#ff4d4f`), nền trắng, chữ `#1a1a1a`.
- **Layout cố định:** Trang khoá `overflow: hidden`, vừa khít viewport; vùng preview dùng nền xám trơn để dễ nhận biết phần trong suốt.
- **Design tokens:** Toàn bộ màu và khoảng cách dùng CSS variables trong `:root` — biến màu (`--accent`, `--accent-grad`, `--accent-soft`) và thang size (`--size-level-0` … `--size-level-5`: 0/4/8/16/32/64px).
- **Liên kết sản phẩm:** Banner dẫn tới js-tools.org ngay dưới tiêu đề.

## 🛠 Công nghệ sử dụng
- **Ngôn ngữ:** Thuần JavaScript (Vanilla JS), HTML5, CSS3.
- **Xử lý ảnh:** HTML5 Canvas API.
- **Đa luồng:** Web Workers.
- **Icons:** SVG nội tuyến (bộ icon Lucide, ISC), không phụ thuộc thư viện/CDN.
- **Không cần cài đặt:** Không phụ thuộc node_modules, không cần build, không gọi CDN runtime.
- **PWA / Offline:** Service worker (`sw.js`) cache toàn bộ tài nguyên tĩnh; có `manifest.webmanifest` để cài như ứng dụng, chạy được khi mất mạng.
- **SEO:** Đầy đủ meta description/keywords, Open Graph và Twitter Card.

## 📦 Cấu trúc dự án
- `index.html`: Cấu trúc giao diện người dùng.
- `style.css`: Định dạng giao diện và hiệu ứng.
- `script.js`: Logic xử lý chính và tương tác.
- `worker.js`: Luồng xử lý pixel tách biệt.
- `sw.js`: Service worker cache tài nguyên cho chế độ offline.
- `manifest.webmanifest`: Khai báo PWA (tên, icon, theme color).
- `favicon.svg`: Favicon / logo dùng chung.
- `robots.txt`: Cho phép crawler index, trỏ tới sitemap.
- `sitemap.xml`: Khai báo URL cho công cụ tìm kiếm.

## 📖 Cách sử dụng
Chỉ cần tải code về và mở file `index.html` bằng bất kỳ trình duyệt hiện đại nào (Chrome, Edge, Firefox).

> ⚠️ Service worker chỉ chạy trên `http(s)` hoặc `localhost` (không hoạt động khi mở trực tiếp bằng `file://`). Để thử offline, chạy một web server tĩnh, ví dụ `python3 -m http.server`.
