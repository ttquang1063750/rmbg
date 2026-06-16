// Xử lý pixel ở luồng riêng.
// Tham số:
// - tolerance: ngưỡng khoảng cách màu để coi là "nền".
// - feather:   bán kính (px) làm mịn cạnh theo không gian trên kênh alpha.
// - shrink:    số px co mặt nạ chủ thể (erode) để ăn bớt viền nền còn sót.
// - despill:   true => khử ám màu nền ở pixel bán trong suốt (decontamination).
// - floodFill: true => chỉ xoá vùng nền NỐI LIỀN từ mép ảnh.
self.onmessage = (e) => {
  const { imageData, targetColor, tolerance, feather, shrink, despill, floodFill } = e.data;
  const { data, width, height } = imageData;
  const n = width * height;
  const toleranceSq = tolerance * tolerance;
  const { r: tr, g: tg, b: tb } = targetColor;

  // 1) Phân loại pixel nền theo khoảng cách màu.
  const isBg = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const dr = data[i] - tr, dg = data[i + 1] - tg, db = data[i + 2] - tb;
    isBg[p] = dr * dr + dg * dg + db * db <= toleranceSq ? 1 : 0;
  }

  // 2) Chỉ giữ vùng nền nối liền từ mép ảnh (flood-fill từ biên).
  if (floodFill) keepBorderConnected(isBg, width, height);

  // 3) Mặt nạ alpha nhị phân.
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) alpha[p] = isBg[p] ? 0 : 255;

  // 4) Co mặt nạ chủ thể (erode vùng đục) để loại viền nền.
  if (shrink > 0) erodeOpaque(alpha, width, height, shrink);

  // 5) Làm mịn cạnh.
  if (feather > 0) boxBlurAlpha(alpha, width, height, feather);

  // 6) Ghi alpha; nếu bật despill thì khử ám màu nền ở pixel bán trong suốt.
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const a = alpha[p];
    if (despill && a > 0 && a < 255) {
      // pixel = a*FG + (1-a)*BG  =>  FG = (pixel - (1-a)*BG) / a
      const af = a / 255;
      const inv = 1 - af;
      data[i]     = clamp255((data[i]     - inv * tr) / af);
      data[i + 1] = clamp255((data[i + 1] - inv * tg) / af);
      data[i + 2] = clamp255((data[i + 2] - inv * tb) / af);
    }
    data[i + 3] = a;
  }

  self.postMessage({ imageData }, [imageData.data.buffer]);
};

// Giữ lại các pixel nền nối liền từ mép ảnh; pixel "nền" bị cô lập bên trong
// chủ thể sẽ được trả về thành chủ thể (không xoá).
function keepBorderConnected(isBg, w, h) {
  const keep = new Uint8Array(isBg.length);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (isBg[p] && !keep[p]) { keep[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0)     push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0)     push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let p = 0; p < isBg.length; p++) isBg[p] = keep[p];
}

// Erosion vùng đục (min-filter tách trục): pixel giữ 255 chỉ khi mọi pixel
// trong bán kính r đều 255, nếu không thành 0 => co viền chủ thể.
function erodeOpaque(a, w, h, r) {
  const tmp = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let k = -r; k <= r; k++) {
        const v = a[row + clamp(x + k, 0, w - 1)];
        if (v < m) m = v;
      }
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 255;
      for (let k = -r; k <= r; k++) {
        const v = tmp[clamp(y + k, 0, h - 1) * w + x];
        if (v < m) m = v;
      }
      a[y * w + x] = m;
    }
  }
}

// Box blur 2 lần (ngang + dọc) bằng sliding window — O(n).
function boxBlurAlpha(a, w, h, r) {
  const tmp = new Float32Array(a.length);
  const div = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += a[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / div;
      sum += a[row + clamp(x + r + 1, 0, w - 1)] - a[row + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = sum / div;
      sum += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
