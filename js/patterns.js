/* Céren — họa tiết trải 360° quanh thân bát.
 * Tấm họa tiết dài 393 mm (chu vi lớn nhất), vẽ trong vùng cao ~18 mm,
 * chừa lề ≥ 5 mm hai đầu để không chạm mép — đúng theo bản vẽ.
 * Cùng một tấm này vừa dán lên mô hình 3D, vừa hiển thị ở "bản trải". */
(function (root) {
  'use strict';

  const CIRC_MM = 393;      // chu vi 360° (mm)
  const MARGIN_MM = 5;      // lề tối thiểu mỗi đầu (mm)

  function rng(seed) {      // mulberry32: ổn định, mỗi lần vẽ ra cùng một kết quả
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PALETTES = {
    sakura: {
      light: { vine: '#8a5c50', leaf: '#b98274', petalIn: '#fff4f1', petalOut: '#d98794', edge: '#b0606d', core: '#e0a24a', bud: '#cf8590' },
      dark:  { vine: '#d9c3a0', leaf: '#9fb59a', petalIn: '#fff3f4', petalOut: '#f0b6c2', edge: '#d98a9a', core: '#e8c37a', bud: '#f0b6c2' }
    },
    magnolia: {
      light: { vine: '#7c6a4c', leaf: '#8f9b78', petalIn: '#fffdf6', petalOut: '#efe4cb', edge: '#8c7a58', core: '#c9a24f', bud: '#e9dcbc' },
      dark:  { vine: '#cdb98b', leaf: '#8fa591', petalIn: '#ffffff', petalOut: '#e9e0cc', edge: '#bfae86', core: '#e2bf72', bud: '#f1e9d6' }
    },
    seigaiha: {
      light: { line: '#8a7a62', fillAlt: 0.0 },
      dark:  { line: '#cdbb94', fillAlt: 0.0 }
    }
  };

  function leaf(ctx, x, y, ang, len, wid, col, vein) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len);
    ctx.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = vein; ctx.lineWidth = Math.max(1, len * 0.035); ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(0, -len * 0.08); ctx.lineTo(0, -len * 0.82); ctx.stroke();
    ctx.restore();
  }

  function sakura(ctx, x, y, r, rot, pal) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i * 2 * Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r * 0.62, -r * 0.2, -r * 0.7, -r * 0.98, -r * 0.15, -r * 1.0);
      ctx.quadraticCurveTo(0, -r * 0.84, r * 0.15, -r * 1.0);
      ctx.bezierCurveTo(r * 0.7, -r * 0.98, r * 0.62, -r * 0.2, 0, 0);
      const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, -r * 0.5, r * 0.95);
      g.addColorStop(0, pal.petalIn); g.addColorStop(1, pal.petalOut);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = pal.edge; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(1, r * 0.05); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.edge; ctx.lineWidth = Math.max(1, r * 0.04);
    for (let i = 0; i < 9; i++) {
      const a = i * 2 * Math.PI / 9, l = r * 0.34;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke();
      ctx.beginPath(); ctx.arc(Math.cos(a) * l, Math.sin(a) * l, r * 0.045, 0, 7); ctx.fillStyle = pal.core; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, 7); ctx.fillStyle = pal.core; ctx.fill();
    ctx.restore();
  }

  function magnolia(ctx, x, y, r, rot, pal) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const n = 9;
    for (let ring = 0; ring < 2; ring++) {
      const cnt = ring === 0 ? n : 6, len = ring === 0 ? r : r * 0.72, wid = ring === 0 ? r * 0.3 : r * 0.24;
      for (let i = 0; i < cnt; i++) {
        ctx.save(); ctx.rotate(i * 2 * Math.PI / cnt + ring * 0.35);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.08);
        ctx.bezierCurveTo(-wid * 1.25, -len * 0.3, -wid * 0.95, -len * 0.95, 0, -len);
        ctx.bezierCurveTo(wid * 0.95, -len * 0.95, wid * 1.25, -len * 0.3, 0, -r * 0.08);
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, pal.petalOut); g.addColorStop(0.7, pal.petalIn); g.addColorStop(1, pal.petalIn);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = pal.edge; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, r * 0.035); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.13, r * 0.2, 0, 0, 7); ctx.fillStyle = pal.core; ctx.fill();
    ctx.restore();
  }

  // Vine + hoa lá chạy quanh thân
  function drawVine(ctx, W, H, kind, dark) {
    const pal = PALETTES[kind][dark ? 'dark' : 'light'];
    const mm = W / CIRC_MM, cy = H / 2;
    const x0 = MARGIN_MM * mm, x1 = W - MARGIN_MM * mm, span = x1 - x0;
    const waves = 6, amp = 4.2 * mm;
    const yAt = x => cy + amp * Math.sin(2 * Math.PI * waves * (x - x0) / span);
    const rand = rng(kind === 'sakura' ? 7 : 19);

    // dây
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.vine; ctx.lineWidth = 0.46 * mm; ctx.globalAlpha = 0.95;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += mm * 0.6) { const y = yAt(x); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();

    // lá, xen kẽ hai bên dây
    ctx.globalAlpha = 0.95;
    let side = 1;
    for (let x = x0 + 6 * mm; x < x1 - 4 * mm; x += (9 + rand() * 4) * mm) {
      const y = yAt(x), dy = yAt(x + 1) - yAt(x - 1);
      const tang = Math.atan2(dy, 2);                       // hướng dây tại điểm này
      const phi = tang + side * (0.75 + rand() * 0.35);     // lá tách khỏi dây ~45–60°
      leaf(ctx, x, y, phi + Math.PI / 2, (3.2 + rand() * 1.6) * mm, (1.1 + rand() * 0.5) * mm, pal.leaf, pal.vine);
      side = -side;
    }

    // nụ nhỏ
    ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const x = x0 + span * (0.04 + i * 0.115 + rand() * 0.02);
      const y = yAt(x) + (i % 2 ? 1 : -1) * (2.2 + rand() * 1.2) * mm;
      ctx.beginPath(); ctx.arc(x, y, (0.7 + rand() * 0.5) * mm, 0, 7); ctx.fillStyle = pal.bud; ctx.fill();
    }

    // hoa chính — 7 bông, to nhỏ khác nhau
    const spots = [0.07, 0.2, 0.33, 0.47, 0.6, 0.74, 0.88];
    const sizes = [4.0, 5.0, 4.4, 5.4, 4.2, 4.9, 3.8];
    spots.forEach((f, i) => {
      const x = x0 + span * f, y = yAt(x) + (i % 2 ? 1.2 : -1.2) * mm;
      const r = sizes[i] * mm, rot = rand() * 6.28;
      kind === 'sakura' ? sakura(ctx, x, y, r, rot, pal) : magnolia(ctx, x, y, r, rot, pal);
    });
    ctx.globalAlpha = 1;
  }

  // Sóng seigaiha: các vòng cung lồng nhau, lát gạch so le
  function drawSeigaiha(ctx, W, H, dark, bg) {
    const pal = PALETTES.seigaiha[dark ? 'dark' : 'light'];
    const mm = W / CIRC_MM, cy = H / 2;
    const x0 = MARGIN_MM * mm, x1 = W - MARGIN_MM * mm;
    const R = 6 * mm, rows = 4, rowStep = R * 0.5;
    const top = cy - (rowStep * (rows - 1) + R) / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, top, x1 - x0, rowStep * (rows - 1) + R); ctx.clip();
    for (let j = 0; j < rows; j++) {
      const y = top + R + j * rowStep;
      const off = (j % 2) * R;
      for (let x = x0 - R + off; x < x1 + R; x += 2 * R) {
        ctx.beginPath(); ctx.arc(x, y, R, Math.PI, 0); ctx.closePath();
        ctx.fillStyle = bg; ctx.globalAlpha = 1; ctx.fill();
        ctx.strokeStyle = pal.line; ctx.lineWidth = 0.28 * mm;
        for (let k = 0; k < 4; k++) {
          ctx.globalAlpha = 0.95 - k * 0.08;
          ctx.beginPath(); ctx.arc(x, y, R * (1 - k * 0.22), Math.PI, 0); ctx.stroke();
        }
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  /** Vẽ tấm họa tiết lên canvas. kind: 'none' | 'sakura' | 'magnolia' | 'seigaiha' */
  function draw(canvas, kind, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    if (kind === 'sakura' || kind === 'magnolia') drawVine(ctx, canvas.width, canvas.height, kind, !!opts.dark);
    else if (kind === 'seigaiha') drawSeigaiha(ctx, canvas.width, canvas.height, !!opts.dark, opts.bg || '#ddd');
  }

  root.CerenPatterns = { draw, CIRC_MM, MARGIN_MM };
})(typeof self !== 'undefined' ? self : this);
