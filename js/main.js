/* Céren — phần tương tác của trang chủ.
 * Gồm: chọn sắc men / họa tiết cho mô hình 3D, ảnh chụp nhỏ từ chính mô hình,
 * bản trải họa tiết 360°, bản vẽ mặt cắt (sinh từ cùng dữ liệu hình học),
 * menu điện thoại, hiện dần khi cuộn, thông tin liên hệ từ site-config.js. */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const CFG = window.CEREN_CONFIG || {};
  const Prof = window.CerenProfile, Pats = window.CerenPatterns, GL = window.Chawan3D;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------------------------------------------------------------- dữ liệu */
  // Năm sắc men theo bản vẽ. Màu ở dạng hex sRGB; "sw" là màu chấm chọn.
  const GLAZES = [
    { id: 'ivory', name: 'Trắng ngà', note: 'chấm tiêu', pattern: 'none', dark: false,
      desc: 'Trắng ngà ấm như hạt gạo mới, điểm những chấm tiêu li ti. Mộc mạc mà sáng, hợp mọi bàn trà.',
      base: '#f1e8d8', deep: '#dccdb0', inner: '#f6efe1', clay: '#d9c09c', speckCol: '#6a4a33', speck: 1, gloss: 0.72, sw: '#efe5d2' },
    { id: 'jade', name: 'Ngọc nhạt', note: '', pattern: 'none', dark: false,
      desc: 'Xanh ngọc dịu như làn nước đầu xuân. Một nền trong trẻo để sắc matcha nổi lên.',
      base: '#c3dbc8', deep: '#a1c1ac', inner: '#d1e5d6', clay: '#d9c09c', speck: 0, gloss: 0.95, sw: '#bcd6c2' },
    { id: 'sea', name: 'Xanh biển', note: '', pattern: 'none', dark: false,
      desc: 'Xanh biển nhạt, phảng phất màu trời sau cơn mưa. Mát, sáng và rất tĩnh.',
      base: '#bccfe0', deep: '#97b3cc', inner: '#cbdae7', clay: '#d9c09c', speck: 0, gloss: 0.95, sw: '#b4cadd' },
    { id: 'blush', name: 'Hồng đất nhạt', note: 'hoa đào', pattern: 'sakura', dark: false,
      desc: 'Hồng đất mềm như cánh đào, với dải hoa đào chạy quanh thân bát.',
      base: '#e8c5c0', deep: '#d6a59e', inner: '#efd3ce', clay: '#d9c09c', speck: 0, gloss: 0.9, sw: '#e6c0ba' },
    { id: 'moss', name: 'Ghi nâu xanh đậm', note: 'ngọc lan', pattern: 'magnolia', dark: true,
      desc: 'Xanh ghi nâu trầm, làm nền cho những đóa ngọc lan sáng màu. Sang và sâu, hợp buổi trà tối.',
      base: '#3b4a3c', deep: '#29362c', inner: '#475840', clay: '#d9c09c', speck: 0, gloss: 1, sw: '#3a4a3b' }
  ];
  const PATTERNS = [
    { id: 'none', label: 'Trơn' },
    { id: 'sakura', label: 'Hoa đào' },
    { id: 'magnolia', label: 'Ngọc lan' },
    { id: 'seigaiha', label: 'Sóng seigaiha' }
  ];
  const state = { glaze: 3, pattern: GLAZES[3].pattern, matcha: false, flipped: false };

  const toGlaze = g => ({
    base: GL.hex(g.base), deep: GL.hex(g.deep), inner: GL.hex(g.inner), clay: GL.hex(g.clay),
    speckCol: GL.hex(g.speckCol || '#6a4a33'), speck: g.speck || 0, gloss: g.gloss
  });

  /* ------------------------------------------------------- khung chung */
  document.documentElement.classList.add('js');
  const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();

  // thanh điều hướng
  const nav = $('#nav'), navToggle = $('#navToggle'), navLinks = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', open); navLinks.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  });
  $$('a', navLinks).forEach(a => a.addEventListener('click', () => {
    navToggle.setAttribute('aria-expanded', 'false'); navLinks.classList.remove('is-open');
  }));

  // hiện dần khi cuộn
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('is-in'));

  // thông tin liên hệ + giá (đọc từ site-config.js)
  (function contact() {
    const items = [];
    if (CFG.email) items.push(['Email', CFG.email, 'mailto:' + CFG.email]);
    if (CFG.phone) items.push(['Điện thoại', CFG.phone, 'tel:' + String(CFG.phone).replace(/[^\d+]/g, '')]);
    if (CFG.zalo) items.push(['Zalo', CFG.zalo.replace(/^https?:\/\//, ''), CFG.zalo]);
    if (CFG.instagram) items.push(['Instagram', CFG.instagram.replace(/^https?:\/\/(www\.)?/, ''), CFG.instagram]);
    if (CFG.facebook) items.push(['Facebook', CFG.facebook.replace(/^https?:\/\/(www\.)?/, ''), CFG.facebook]);
    if (CFG.address) items.push(['Xưởng · Showroom', CFG.address, '']);
    const list = $('#contactList');
    if (items.length) {
      $('#contactLead').textContent = 'Nhắn cho Céren để đặt chawan hoặc hỏi thêm về từng sắc men và họa tiết.';
      items.forEach(([label, val, href]) => {
        const li = document.createElement('li');
        const el = document.createElement(href ? 'a' : 'div');
        el.className = 'contact__item';
        if (href) { el.href = href; if (/^https?:/.test(href)) { el.target = '_blank'; el.rel = 'noopener'; } }
        el.innerHTML = '<small></small><span></span>';
        el.firstChild.textContent = label; el.lastChild.textContent = val;
        li.appendChild(el); list.appendChild(li);
      });
    } else list.hidden = true;
    if (CFG.price) { const p = $('#priceLine'); p.textContent = 'Giá: ' + CFG.price; p.hidden = false; }
  })();

  /* ------------------------------------------------------- bản vẽ SVG */
  const f1 = n => n.toFixed(1);
  const vn = n => String(n).replace('.', ',');

  function buildSection() {
    const svg = $('#sectionSvg'); if (!svg || !Prof) return;
    const S = Prof.build(8).samples;
    const sc = 41, cx = 430, y0 = 436;
    const X = r => cx + r * sc, Y = y => y0 - y * sc;
    const right = S.map(p => f1(X(p.r)) + ' ' + f1(Y(p.y)));
    const left = S.map(p => f1(X(-p.r)) + ' ' + f1(Y(p.y))).reverse();
    const d = 'M' + right.join('L') + 'L' + left.join('L') + 'Z';

    const t = (x, y, s, cls, anchor, rot) =>
      `<text x="${f1(x)}" y="${f1(y)}" class="svg-text ${cls || ''}" text-anchor="${anchor || 'start'}"${rot ? ` transform="rotate(${rot} ${f1(x)} ${f1(y)})"` : ''}>${s}</text>`;
    const ln = (x1, y1, x2, y2, cls, mk) =>
      `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="${cls}"${mk ? ' marker-start="url(#ar)" marker-end="url(#ar)"' : ''}/>`;

    const top = Y(7.5), rimY = top - 30, bodyY = top - 66;
    let g = '';
    // đường trục
    g += ln(cx, top - 14, cx, Y(0) + 14, 'svg-axis');
    // chiều cao 7,5
    const hx = X(-6.25) - 64;
    g += ln(X(-5.5) - 8, top, hx - 8, top, 'svg-dim-ext') + ln(X(-2.25) - 8, Y(0), hx - 8, Y(0), 'svg-dim-ext');
    g += ln(hx, Y(0), hx, top, 'svg-dim', 1) + t(hx - 10, (Y(0) + top) / 2, 'Cao 7,5 cm', 'svg-text--g', 'middle', -90);
    // đường kính miệng Ø11
    g += ln(X(-5.5), top - 4, X(-5.5), rimY - 8, 'svg-dim-ext') + ln(X(5.5), top - 4, X(5.5), rimY - 8, 'svg-dim-ext');
    g += ln(X(-5.5), rimY, X(5.5), rimY, 'svg-dim', 1) + t(cx, rimY - 8, 'Ø 11 cm · miệng', 'svg-text--g', 'middle');
    // đường kính thân Ø12,5
    g += ln(X(-6.25), Y(4.4), X(-6.25), bodyY - 8, 'svg-dim-ext') + ln(X(6.25), Y(4.4), X(6.25), bodyY - 8, 'svg-dim-ext');
    g += ln(X(-6.25), bodyY, X(6.25), bodyY, 'svg-dim', 1) + t(cx, bodyY - 8, 'Ø 12,5 cm · thân lớn nhất · chu vi ≈ 39,3 cm', 'svg-text--g', 'middle');
    // chân đế Ø4,5
    const footY = Y(0) + 34;
    g += ln(X(-2.25), Y(0) + 4, X(-2.25), footY + 8, 'svg-dim-ext') + ln(X(2.25), Y(0) + 4, X(2.25), footY + 8, 'svg-dim-ext');
    g += ln(X(-2.25), footY, X(2.25), footY, 'svg-dim', 1) + t(cx, footY + 24, 'Ø 4,5 cm · chân đế', 'svg-text--g', 'middle');
    // chú thích độ dày — đặt trong lòng bát để không đè lên đường kích thước
    g += ln(X(5.3), Y(7.3), X(3.5), Y(7.3), 'svg-dim') + t(X(3.4), Y(7.3) - 4, 'Thành miệng', 'svg-text--s', 'end') + t(X(3.4), Y(7.3) + 13, '0,3 – 0,4 cm', '', 'end');
    g += ln(X(5.78), Y(4.4), X(3.9), Y(4.4), 'svg-dim') + t(X(3.8), Y(4.4) - 4, 'Thành bụng', 'svg-text--s', 'end') + t(X(3.8), Y(4.4) + 13, '0,4 – 0,5 cm', '', 'end');
    g += ln(cx, Y(1.1), X(0.8), Y(3.0), 'svg-dim') + t(X(0.95), Y(3.0) - 4, 'Lòng bát lõm nhẹ', 'svg-note', 'start');
    g += ln(X(0.8), Y(0.7), X(4.0), Y(0.7), 'svg-dim') + t(X(4.1), Y(0.7) - 2, 'Đế dày 0,8 cm', '', 'start') + t(X(4.1), Y(0.7) + 14, 'đế nhám, không tráng men', 'svg-text--s', 'start');
    g += ln(X(5.5), Y(7.5) + 4, X(6.9), Y(7.5) + 4, 'svg-dim') + t(X(7.0), Y(7.5) + 8, 'Miệng cong vào &lt; 4°', 'svg-text--s', 'start');

    svg.insertAdjacentHTML('beforeend',
      `<defs>
         <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="svg-hatch-line"/></pattern>
         <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" class="svg-dim-arrow"/></marker>
       </defs>
       <path d="${d}" fill="url(#hatch)"/><path d="${d}" class="svg-solid"/>${g}`);
  }

  // Bản phác giá đỡ chổi chasen (kusenaoshi): cao 7, Ø3 trên, Ø5,8 đế — tỉ lệ minh họa
  function buildKuse() {
    const svg = $('#kuseSvg'); if (!svg) return;
    const sc = 42, cx = 150, y0 = 330;
    const X = r => f1(cx + r * sc), Y = y => f1(y0 - y * sc);
    const half = `M${X(0)} ${Y(0)} L${X(2.9)} ${Y(0)} C${X(2.9)} ${Y(0.35)} ${X(2.75)} ${Y(0.5)} ${X(2.4)} ${Y(0.82)} ` +
      `C${X(1.9)} ${Y(1.25)} ${X(1.45)} ${Y(1.6)} ${X(1.45)} ${Y(2.35)} C${X(1.45)} ${Y(3.05)} ${X(2.15)} ${Y(3.5)} ${X(2.15)} ${Y(4.5)} ` +
      `C${X(2.15)} ${Y(5.6)} ${X(1.5)} ${Y(6.05)} ${X(1.5)} ${Y(7)} L${X(0)} ${Y(7)}`;
    const dim = (x1, y1, x2, y2) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="svg-dim" marker-start="url(#ar2)" marker-end="url(#ar2)"/>`;
    const ext = (x1, y1, x2, y2) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="svg-dim-ext"/>`;
    const tx = (x, y, s, a, rot) => `<text x="${f1(x)}" y="${f1(y)}" class="svg-text svg-text--g" text-anchor="${a}"${rot ? ` transform="rotate(${rot} ${f1(x)} ${f1(y)})"` : ''}>${s}</text>`;
    svg.innerHTML =
      `<defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" class="svg-dim-arrow"/></marker></defs>
       <line x1="${cx}" y1="${f1(y0 - 7 * sc - 18)}" x2="${cx}" y2="${f1(y0 + 14)}" class="svg-axis"/>
       <g id="kHalf"><path d="${half} Z" class="svg-solid" style="stroke:none"/><path d="${half}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/></g>
       <use href="#kHalf" transform="translate(${2 * cx} 0) scale(-1 1)"/>
       ${ext(cx - 2.9 * sc - 56, y0, cx - 2.9 * sc, y0)}${ext(cx - 2.9 * sc - 56, y0 - 7 * sc, cx - 1.5 * sc, y0 - 7 * sc)}
       ${dim(cx - 2.9 * sc - 44, y0, cx - 2.9 * sc - 44, y0 - 7 * sc)}${tx(cx - 2.9 * sc - 54, y0 - 3.5 * sc, 'Cao 7 cm', 'middle', -90)}
       ${ext(cx - 1.5 * sc, y0 - 7 * sc - 4, cx - 1.5 * sc, y0 - 7 * sc - 30)}${ext(cx + 1.5 * sc, y0 - 7 * sc - 4, cx + 1.5 * sc, y0 - 7 * sc - 30)}
       ${dim(cx - 1.5 * sc, y0 - 7 * sc - 22, cx + 1.5 * sc, y0 - 7 * sc - 22)}${tx(cx, y0 - 7 * sc - 30, 'Ø 3 cm', 'middle')}
       ${ext(cx - 2.9 * sc, y0 + 4, cx - 2.9 * sc, y0 + 32)}${ext(cx + 2.9 * sc, y0 + 4, cx + 2.9 * sc, y0 + 32)}
       ${dim(cx - 2.9 * sc, y0 + 24, cx + 2.9 * sc, y0 + 24)}${tx(cx, y0 + 44, 'Ø 5,8 cm · đế khắc logo Céren', 'middle')}`;
  }

  buildSection();
  buildKuse();

  /* ------------------------------------------------------ chọn men & họa tiết */
  const swatchBox = $('#swatches'), nameEl = $('#glazeName');
  const stripCanvas = $('#strip'), stripBox = stripCanvas ? stripCanvas.parentElement : null;
  const patCanvas = document.createElement('canvas'); patCanvas.width = 4096; patCanvas.height = 256;
  let viewer = null;

  GLAZES.forEach((g, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.style.setProperty('--sw', g.sw);
    b.setAttribute('aria-label', g.name + (g.note ? ' (' + g.note + ')' : ''));
    b.title = g.name + (g.note ? ' · ' + g.note : '');
    b.addEventListener('click', () => pickGlaze(i));
    swatchBox.appendChild(b);
  });

  function chipGroup(box) {
    PATTERNS.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = p.label; b.dataset.p = p.id;
      b.addEventListener('click', () => { state.pattern = p.id; apply(); });
      box.appendChild(b);
    });
  }
  chipGroup($('#patterns')); chipGroup($('#stripPatterns'));

  function pickGlaze(i) { state.glaze = i; state.pattern = GLAZES[i].pattern; apply(); }

  function apply() {
    const g = GLAZES[state.glaze];
    $$('.swatch', swatchBox).forEach((b, i) => b.setAttribute('aria-pressed', i === state.glaze));
    nameEl.innerHTML = '';
    nameEl.append(g.name);
    if (g.note) { const s = document.createElement('small'); s.textContent = '· ' + g.note; nameEl.appendChild(s); }
    $$('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.p === state.pattern));

    if (viewer) {
      viewer.setGlaze(toGlaze(g));
      if (state.pattern === 'none') viewer.setPattern(null);
      else { Pats.draw(patCanvas, state.pattern, { dark: g.dark, bg: g.base }); viewer.setPattern(patCanvas); }
    }
    // bản trải 360°
    if (stripCanvas) {
      stripBox.style.setProperty('--strip-bg', g.base);
      Pats.draw(stripCanvas, state.pattern, { dark: g.dark, bg: g.base });
      if (state.pattern === 'none') {
        const x = stripCanvas.getContext('2d');
        x.fillStyle = g.dark ? 'rgba(235,225,200,.55)' : 'rgba(90,64,30,.45)';
        x.font = 'italic 500 54px "Cormorant Garamond", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('Men trơn — không họa tiết', stripCanvas.width / 2, stripCanvas.height / 2);
      }
    }
  }

  /* ------------------------------------------------------------- 3D */
  try {
    viewer = new GL($('#bowl'), { yaw: -0.5 });
  } catch (err) {
    document.documentElement.classList.add('no-gl');
    $('#stageFallback').hidden = false;
    if (window.console) console.warn('Không dựng được 3D:', err.message);
  }
  apply();

  if (viewer) {
    const canvas = $('#bowl'), hint = $('#stageHint');
    const hideHint = () => hint.classList.add('is-gone');
    canvas.addEventListener('pointerdown', hideHint);
    canvas.addEventListener('keydown', hideHint);
    setTimeout(hideHint, 9000);
    if ('ResizeObserver' in window) new ResizeObserver(() => { viewer.dirty = true; }).observe(canvas);
    window.addEventListener('resize', () => { viewer.dirty = true; });

    const tM = $('#tMatcha'), tB = $('#tBase');
    tM.addEventListener('click', () => {
      state.matcha = !state.matcha; viewer.setMatcha(state.matcha); tM.setAttribute('aria-pressed', state.matcha);
    });
    tB.addEventListener('click', () => {
      state.flipped = !state.flipped; viewer.setFlipped(state.flipped); tB.setAttribute('aria-pressed', state.flipped);
      hideHint();
    });
  }

  /* ----------------------------------- ảnh chụp từ chính mô hình 3D (nền trong suốt) */
  function snapshots() {
    if (!GL || document.documentElement.classList.contains('no-gl')) return;
    const c = document.createElement('canvas'); c.width = c.height = 600;
    let s; try { s = new GL(c, { manual: true }); } catch (e) { return; }
    const tmp = document.createElement('canvas'); tmp.width = 4096; tmp.height = 256;
    const SIZE = 560;

    const show = (img, url) => { if (!img) return; img.onload = () => img.classList.add('is-ready'); img.src = url; };
    const prep = (g, pattern) => {
      s.setGlaze(toGlaze(g));
      if (pattern === 'none') s.setPattern(null);
      else { Pats.draw(tmp, pattern, { dark: g.dark, bg: g.base }); s.setPattern(tmp); }
    };
    const jobs = [];
    // thẻ men ở mục "Men & họa tiết"
    GLAZES.forEach((g, i) => jobs.push(() => { prep(g, g.pattern); show($('.gcard__img img', gallery.children[i]), s.shot(SIZE, { yaw: -0.62, pitch: 0.3 })); }));
    // ba ảnh chi tiết ở mục "Sản phẩm"
    const detail = (key, gi, pat, st) => jobs.push(() => { prep(GLAZES[gi], pat); show($('[data-snap="' + key + '"]'), s.shot(SIZE, st)); });
    detail('d-matcha', 0, 'none', { yaw: 0.2, pitch: 1.12, matcha: true });
    detail('d-side', 3, 'sakura', { yaw: -0.3, pitch: 0.03 });
    detail('d-base', 4, 'magnolia', { yaw: 0.35, pitch: -1.2 });

    (function next() {
      const j = jobs.shift();
      if (!j) { s.destroy(); return; }
      try { j(); } catch (e) { /* bỏ qua ảnh lỗi, giữ chấm màu thay thế */ }
      setTimeout(next, 40);
    })();
  }

  /* ---------------------------------------------------- thẻ men (gallery) */
  const gallery = $('#gallery');
  GLAZES.forEach((g, i) => {
    const li = document.createElement('li'); li.className = 'reveal';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'gcard__btn';
    btn.style.setProperty('--sw', g.sw);
    btn.innerHTML = '<span class="gcard__img" style="--sw:' + g.sw + '"><img width="280" height="280" alt=""></span>' +
      '<span class="gcard__name"></span><span class="gcard__sub"></span><span class="gcard__desc"></span>' +
      '<span class="gcard__cta">Xem trên 3D</span>';
    $('.gcard__img img', btn).alt = 'Chiếc bát men ' + g.name.toLowerCase() + (g.note ? ', ' + g.note : '');
    $('.gcard__name', btn).textContent = g.name;
    $('.gcard__sub', btn).textContent = g.note || 'men trơn';
    $('.gcard__desc', btn).textContent = g.desc;
    btn.addEventListener('click', () => { pickGlaze(i); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    li.appendChild(btn); gallery.appendChild(li);
    if ('IntersectionObserver' in window) { /* quan sát để hiện dần */ }
  });
  // thẻ vừa tạo cũng cần hiệu ứng hiện dần
  if ('IntersectionObserver' in window) {
    const io2 = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io2.unobserve(e.target); }
    }), { threshold: 0.1 });
    $$('li', gallery).forEach(li => io2.observe(li));
  } else $$('li', gallery).forEach(li => li.classList.add('is-in'));

  // chụp ảnh sau khi khung hình đầu tiên đã hiện, để không làm chậm lần tải đầu
  const later = window.requestIdleCallback ? fn => requestIdleCallback(fn, { timeout: 1500 }) : fn => setTimeout(fn, 400);
  if (document.readyState === 'complete') later(snapshots); else window.addEventListener('load', () => later(snapshots));
})();
