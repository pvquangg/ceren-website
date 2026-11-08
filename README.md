# Céren — website giới thiệu chawan

Website một trang cho hãng gốm **Céren**: banner 3D chiếc bát chawan, tiểu sử thương hiệu, thông số, năm sắc men, họa tiết 360°, bản vẽ mặt cắt, kusenaoshi và nghi thức đánh matcha. Tone be vàng, nâu nhạt.

## Mở xem

Bấm đúp `index.html` là chạy (Chrome, Edge, Safari, Firefox đều được). Không cần cài gì, không cần mạng — chỉ phông chữ Google (Cormorant Garamond, Be Vietnam Pro) cần mạng, nếu không có sẽ tự dùng phông dự phòng.

Toàn bộ dự án nặng dưới 1 MB (không tính `assets/ban-ve-chawan.png`, chỉ để tham khảo), nên để ở ổ nào cũng được.

## Cấu trúc

```
index.html            Nội dung và khung trang (tiếng Việt)
css/style.css         Giao diện. Màu nằm ở :root, đổi một chỗ là đổi cả trang
js/site-config.js     Điền email, điện thoại, Zalo, Instagram, địa chỉ, giá. Để trống thì mục đó tự ẩn
js/profile.js         Hình học chiếc bát, lấy từ số đo trên bản vẽ (đơn vị cm)
js/patterns.js        Họa tiết trải 360° (hoa đào, ngọc lan, sóng seigaiha)
js/chawan3d.js        Bộ dựng 3D bằng WebGL thuần, không dùng thư viện ngoài
js/main.js            Chọn men/họa tiết, ảnh chụp từ mô hình 3D, bản vẽ SVG, menu
assets/ban-ve-chawan.png   Bản vẽ gốc bạn gửi (không dùng trên web)
```

## Chỉnh sửa thường gặp

- **Thêm thông tin liên hệ / giá**: mở `js/site-config.js`, điền vào dấu nháy.
- **Đổi màu men**: trong `js/main.js`, mảng `GLAZES` (mã màu hex).
- **Đổi số đo bát**: `js/profile.js` (`SPEC`, `OUTER`, `WALL`, `FLOOR`). Mô hình 3D và bản vẽ mặt cắt tự cập nhật theo.
- **Đổi chữ**: sửa trực tiếp trong `index.html`.

## Đưa lên mạng

Đây là website tĩnh. Kéo thả cả thư mục vào Netlify, Cloudflare Pages hoặc Vercel, hoặc đẩy lên GitHub Pages là có link.

## Ghi chú kỹ thuật

- Mô hình 3D chỉ vẽ khi đang hiện trên màn hình và tự dừng khi chuyển tab, để tiết kiệm pin.
- Nếu trình duyệt không có WebGL, trang tự ẩn phần 3D và vẫn đọc được đầy đủ.
- Tôn trọng `prefers-reduced-motion`: tắt xoay tự động và hiệu ứng khi người dùng bật giảm chuyển động.
