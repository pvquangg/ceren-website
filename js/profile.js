/* Céren — hình học chiếc chawan, sinh trực tiếp từ bản vẽ kỹ thuật (đơn vị: cm).
 * Trục y đi từ đáy (0) lên miệng (7.5). Mặt cắt quay quanh trục y để ra mô hình 3D.
 * File này chạy được cả trong trình duyệt lẫn Node (để kiểm tra số đo). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CerenProfile = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Thông số lấy từ bản vẽ
  const SPEC = {
    height: 7.5,
    rimDia: 11,
    bodyDia: 12.5,
    footDia: 4.5,
    rimWall: [0.3, 0.4],
    bellyWall: [0.4, 0.5],
    floor: 0.8,
    rimLeanDeg: 4,
    circumference: Math.PI * 12.5,          // ≈ 39.27 cm
    band: { center: 5.6, height: 1.8, margin: 0.5 } // vùng họa tiết: cao 1.5–2 cm, cách mép ≥ 5 mm
  };

  // Đường viền ngoài [bán kính, độ cao]: tâm đáy → chân đế → thân → miệng
  const OUTER = [
    [0, 0.30], [0.8, 0.30], [1.35, 0.29], [1.46, 0.14], [1.58, 0.03],
    [1.80, 0], [2.05, 0], [2.18, 0.03], [2.25, 0.14], [2.25, 0.45],
    [2.38, 0.80], [2.85, 1.12], [3.50, 1.45], [4.40, 1.95], [5.30, 2.60],
    [5.90, 3.20], [6.20, 3.80], [6.25, 4.40], [6.17, 5.00], [5.98, 5.60],
    [5.78, 6.10], [5.63, 6.50], [5.55, 6.80], [5.515, 7.05], [5.50, 7.33]
  ];
  const OUTER_WALL_FROM = 14; // từ điểm này trở lên là thành bát (để tạo mặt trong)

  // Độ dày thành theo độ cao: 0.3–0.4 ở miệng, 0.4–0.5 ở bụng
  const WALL = [[1.45, 0.48], [2.6, 0.48], [3.8, 0.46], [4.9, 0.45], [6.1, 0.42], [6.98, 0.38], [7.2, 0.35]];
  function wallAt(y) {
    if (y <= WALL[0][0]) return WALL[0][1];
    for (let i = 1; i < WALL.length; i++) {
      if (y <= WALL[i][0]) {
        const a = WALL[i - 1], b = WALL[i], k = (y - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return WALL[WALL.length - 1][1];
  }

  // Lòng bát lõm nhẹ xuống ở giữa (đáy trong thấp hơn một chút), dày đế 0.8 cm
  const FLOOR = [[2.45, 1.50], [1.5, 1.24], [0.7, 1.13], [0, 1.10]];

  function controlPoints() {
    const pts = [], part = [];
    OUTER.forEach(p => { pts.push(p); part.push(0); });

    // Môi miệng bo tròn (bán kính 0.17 cm)
    const last = OUTER[OUTER.length - 1];
    const lipR = 0.17, cx = last[0] - lipR, cy = last[1];
    for (let a = 30; a <= 180; a += 30) {
      const t = a * Math.PI / 180;
      pts.push([cx + lipR * Math.cos(t), cy + lipR * Math.sin(t)]);
      part.push(0.5);
    }

    // Mặt trong = mặt ngoài dịch vào theo pháp tuyến một đoạn bằng độ dày thành
    for (let i = OUTER.length - 2; i >= OUTER_WALL_FROM; i--) {
      const prev = OUTER[i - 1], next = OUTER[i + 1], p = OUTER[i];
      let tx = next[0] - prev[0], ty = next[1] - prev[1];
      const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      const nx = ty, ny = -tx;             // pháp tuyến hướng ra ngoài
      const t = wallAt(p[1]);
      pts.push([p[0] - nx * t, p[1] - ny * t]);
      part.push(1);
    }
    FLOOR.forEach(p => { pts.push(p); part.push(1); });
    return { pts, part };
  }

  // Catmull-Rom hướng tâm (centripetal) — mượt, không vọt lố
  function lerp2(a, b, ta, tb, t) {
    const u = (tb - t) / (tb - ta), v = (t - ta) / (tb - ta);
    return [a[0] * u + b[0] * v, a[1] * u + b[1] * v];
  }
  function crPoint(p0, p1, p2, p3, t) {
    const d = (a, b) => Math.pow(Math.hypot(a[0] - b[0], a[1] - b[1]), 0.5) || 1e-4;
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const tt = t1 + (t2 - t1) * t;
    const A1 = lerp2(p0, p1, t0, t1, tt), A2 = lerp2(p1, p2, t1, t2, tt), A3 = lerp2(p2, p3, t2, t3, tt);
    const B1 = lerp2(A1, A2, t0, t2, tt), B2 = lerp2(A2, A3, t1, t3, tt);
    return lerp2(B1, B2, t1, t2, tt);
  }

  function build(stepsPerSegment) {
    const steps = stepsPerSegment || 10;
    const { pts, part } = controlPoints();
    const n = pts.length;
    // điểm ảo đối xứng qua trục để tiếp tuyến tại tâm nằm ngang
    const P = [[-pts[1][0], pts[1][1]]].concat(pts, [[-pts[n - 2][0], pts[n - 2][1]]]);
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < steps; s++) {
        const q = crPoint(P[i], P[i + 1], P[i + 2], P[i + 3], s / steps);
        out.push({ r: Math.max(0, q[0]), y: q[1], part: part[i] });
      }
    }
    out.push({ r: Math.max(0, pts[n - 1][0]), y: pts[n - 1][1], part: part[n - 1] });

    // Pháp tuyến + độ dài cung
    let total = 0;
    out[0].s = 0;
    for (let i = 1; i < out.length; i++) {
      total += Math.hypot(out[i].r - out[i - 1].r, out[i].y - out[i - 1].y);
      out[i].s = total;
    }
    for (let i = 0; i < out.length; i++) {
      const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
      let tx = b.r - a.r, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      out[i].nr = ty; out[i].ny = -tx;
      out[i].s /= total;
    }
    return { samples: out, spec: SPEC, control: pts };
  }

  // Bán kính mặt trong tại độ cao y (để đặt mặt matcha)
  function innerRadiusAt(profile, y) {
    const s = profile.samples;
    let r = null;
    for (let i = 1; i < s.length; i++) {
      if (s[i].part < 0.75 || s[i - 1].part < 0.75) continue;
      const a = s[i - 1], b = s[i];
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y && a.y > 1.6) {
        r = a.r + (b.r - a.r) * (y - a.y) / (b.y - a.y);
      }
    }
    return r;
  }

  return { SPEC, build, innerRadiusAt, wallAt };
});
