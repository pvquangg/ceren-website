/* Céren — trình dựng 3D chawan bằng WebGL thuần (không cần thư viện ngoài).
 * Mặt cắt trong profile.js được quay quanh trục để ra thân bát; men, họa tiết,
 * chấm tiêu, đế mộc khắc chìm và mặt matcha đều xử lý trong shader (chạy bằng GPU của máy).
 * Chỉ vẽ khi khung hình đang hiện trên màn hình để tiết kiệm pin. */
(function (root) {
  'use strict';
  const Prof = root.CerenProfile;

  /* ---------- toán ma trận (cột trước) ---------- */
  const M = {
    ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
      return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    trans(x, y, z) { const o = M.ident(); o[12] = x; o[13] = y; o[14] = z; return o; },
    rotX(a) { const c = Math.cos(a), s = Math.sin(a), o = M.ident(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
    rotY(a) { const c = Math.cos(a), s = Math.sin(a), o = M.ident(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- GLSL ---------- */
  const PRECISION = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';

  // Môi trường phòng chụp: nền be ấm + vài softbox → men bóng phản chiếu như gốm thật
  const ENV = `
    vec3 env(vec3 r){
      float h = r.y * 0.5 + 0.5;
      vec3 col = mix(vec3(0.46,0.38,0.30), vec3(0.96,0.92,0.85), smoothstep(0.05, 0.95, h));
      float k1 = smoothstep(0.78, 0.93, dot(r, normalize(vec3(-0.55, 0.75, 0.45))));
      float k2 = smoothstep(0.86, 0.97, dot(r, normalize(vec3(0.85, 0.30, 0.35))));
      float k3 = smoothstep(0.88, 0.98, dot(r, normalize(vec3(0.05, 0.45, -1.0))));
      col += k1 * vec3(1.10, 1.05, 0.96) * 1.1;
      col += k2 * vec3(0.90, 0.95, 1.00) * 0.55;
      col += k3 * vec3(1.00, 0.96, 0.90) * 0.7;
      return col;
    }
    float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1.0,0.0)), f.x), mix(hash12(i + vec2(0.0,1.0)), hash12(i + vec2(1.0,1.0)), f.x), f.y);
    }
    vec3 softClip(vec3 c){ vec3 o = max(c - 0.8, 0.0); return min(c, vec3(0.8)) + 0.2 * (1.0 - exp(-o * 5.0)); }
  `;

  const VS_BOWL = `
    attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aMeta;
    uniform mat4 uVP; uniform mat4 uModel;
    varying vec3 vPos; varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vMeta;
    void main(){
      vPos = aPos; vMeta = aMeta;
      vec4 w = uModel * vec4(aPos, 1.0);
      vWPos = w.xyz;
      vWNrm = (uModel * vec4(aNrm, 0.0)).xyz;
      gl_Position = uVP * w;
    }`;

  const FS_BOWL = PRECISION + ENV + `
    varying vec3 vPos; varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vMeta;
    uniform vec3 uCam, uBase, uDeep, uInner, uSpeckCol, uClay;
    uniform float uGloss, uSpeck, uHasPat;
    uniform vec2 uBand;
    uniform sampler2D uPat; uniform sampler2D uLogo;

    float speck(vec3 p, float sc, float thr){
      vec3 q = p * sc; vec3 i = floor(q); vec3 f = fract(q);
      float h = hash13(i);
      vec3 c = vec3(hash13(i + 7.1), hash13(i + 13.7), hash13(i + 3.3));
      float d = length(f - c);
      float sz = 0.08 + 0.2 * hash13(i + 1.9);
      return step(thr, h) * (1.0 - smoothstep(sz * 0.4, sz, d));
    }

    void main(){
      vec3 N = normalize(vWNrm);
      vec3 V = normalize(uCam - vWPos);
      float y = vPos.y;
      float rad = length(vPos.xz);
      float outside = 1.0 - step(0.25, vMeta.z);
      float inside  = step(0.75, vMeta.z);

      // men: đọng đậm hơn ở phần dưới, mỏng sáng ở sát miệng
      vec3 base = mix(uBase, uInner, inside);
      base = mix(base, uDeep, (1.0 - smoothstep(1.3, 4.8, y)) * 0.55);
      base = mix(base, mix(base, uClay, 0.5), smoothstep(7.25, 7.5, y) * 0.28);

      // chấm tiêu (các đốm sắt nhỏ trong men)
      if (uSpeck > 0.0) {
        float sp = max(speck(vPos, 4.0, 0.55), 0.85 * speck(vPos + vec3(3.1, 1.7, 5.3), 9.0, 0.6));
        base = mix(base, uSpeckCol, sp * uSpeck);
      }

      // họa tiết 360° (chỉ ở mặt ngoài, trong vùng band)
      float pv = (y - uBand.x) / uBand.y;
      vec4 pc = texture2D(uPat, vec2(vMeta.x, clamp(1.0 - pv, 0.0, 1.0)));
      float pm = outside * uHasPat * step(0.0, pv) * step(pv, 1.0);
      base = base * (1.0 - pc.a * pm) + pc.rgb * pm;

      // chân đế mộc (không tráng men), hạt đất li ti
      float clay = outside * (1.0 - smoothstep(0.48, 0.62, y));
      base = mix(base, uClay, clay);
      base *= 1.0 + clay * (hash13(floor(vPos * 42.0)) - 0.5) * 0.2;

      // dấu CEREN khắc chìm ở đáy
      vec2 lu = vec2(vPos.x, -vPos.z) / 2.8 + 0.5;
      float eng = texture2D(uLogo, lu).a * outside * step(rad, 1.4) * step(y, 0.4);
      base *= 1.0 - 0.5 * eng;

      // ánh sáng
      float ndv = max(dot(N, V), 0.0);
      vec3 L1 = normalize(vec3(-0.5, 0.78, 0.5));
      vec3 L2 = normalize(vec3(0.85, 0.25, 0.35));
      float d1 = max(dot(N, L1), 0.0), d2 = max(dot(N, L2), 0.0);
      float hemi = N.y * 0.5 + 0.5;
      vec3 amb = mix(vec3(0.46, 0.39, 0.32), vec3(0.80, 0.76, 0.70), hemi);
      vec3 bounce = max(-N.y, 0.0) * vec3(0.50, 0.42, 0.33) * 0.55;
      vec3 diff = base * (amb * 0.78 + bounce + d1 * vec3(1.0, 0.96, 0.9) * 0.82 + d2 * vec3(0.86, 0.9, 1.0) * 0.22);

      float cav = inside * clamp((7.5 - y) / 6.4, 0.0, 1.0);
      diff *= 1.0 - 0.36 * cav;

      float gloss = uGloss * (1.0 - clay);
      vec3 R = reflect(-V, N);
      float F = 0.045 + 0.955 * pow(1.0 - ndv, 5.0);
      vec3 spec = env(R) * F * gloss * (1.0 - 0.65 * cav);
      vec3 H = normalize(L1 + V);
      spec += pow(max(dot(N, H), 0.0), 140.0) * gloss * 0.85;
      spec += env(R) * 0.05 * gloss;   // lớp bóng nền

      vec3 col = softClip(diff + spec);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const VS_DISC = `
    attribute vec3 aPos;
    uniform mat4 uVP; uniform mat4 uModel; uniform float uScale; uniform float uY;
    varying vec3 vPos; varying vec3 vWPos;
    void main(){
      vec3 p = vec3(aPos.x * uScale, uY, aPos.z * uScale);
      vPos = p;
      vec4 w = uModel * vec4(p, 1.0);
      vWPos = w.xyz;
      gl_Position = uVP * w;
    }`;

  const FS_DISC = PRECISION + ENV + `
    varying vec3 vPos; varying vec3 vWPos;
    uniform float uMode, uFade, uR;
    uniform vec3 uCam;
    void main(){
      if (uMode < 0.5) {                       // bóng đổ mềm dưới đáy bát
        float r = length(vPos.xz);
        float a = 0.36 * exp(-pow(r / 3.1, 2.0)) + 0.12 * exp(-pow(r / 4.8, 2.0));
        a *= (1.0 - smoothstep(4.2, 6.6, r)) * uFade;   // tắt hẳn trước mép khung để không lộ viền chữ nhật
        gl_FragColor = vec4(vec3(0.24, 0.15, 0.08) * a, a);
      } else {                                  // mặt matcha
        float r = length(vPos.xz) / uR;
        vec2 q = vPos.xz;
        float n = vnoise(q * 1.7) * 0.55 + vnoise(q * 4.6 + 3.0) * 0.3 + vnoise(q * 11.0) * 0.15;
        vec3 deep = vec3(0.34, 0.46, 0.13), light = vec3(0.52, 0.65, 0.23);
        vec3 col = mix(deep, light, smoothstep(0.2, 0.9, n) * 0.6);
        // bọt li ti
        vec2 g = q * 9.0; vec2 gi = floor(g), gf = fract(g);
        float bub = (1.0 - smoothstep(0.12, 0.32, length(gf - vec2(hash12(gi), hash12(gi + 5.7))))) * step(0.45, hash12(gi + 2.3));
        col = mix(col, vec3(0.70, 0.80, 0.42), bub * 0.3);
        col = mix(col, deep * 0.62, smoothstep(0.86, 1.0, r));           // viền sẫm sát thành bát
        vec3 N = normalize(vec3((n - 0.5) * 0.18, 1.0, (vnoise(q * 3.0 + 9.0) - 0.5) * 0.18));
        vec3 V = normalize(uCam - vWPos);
        float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        col = col * 0.92 + env(reflect(-V, N)) * F * 0.55;
        gl_FragColor = vec4(softClip(col), 1.0);
      }
    }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s); gl.deleteShader(s);
      throw new Error('Shader lỗi: ' + log);
    }
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link lỗi: ' + gl.getProgramInfoLog(p));
    const loc = {};
    const nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nU; i++) { const n = gl.getActiveUniform(p, i).name; loc[n] = gl.getUniformLocation(p, n); }
    return { p, loc };
  }

  function hex(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }

  /* Logo CEREN khắc ở đáy (chỉ dùng kênh alpha) */
  function logoCanvas() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.strokeStyle = '#000';
    x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 98, 0, 7); x.stroke();
    x.lineWidth = 1.5; x.beginPath(); x.arc(128, 128, 90, 0, 7); x.stroke();
    x.font = '600 34px "Cormorant Garamond", Georgia, serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const word = 'CEREN', gap = 8;
    const widths = [...word].map(ch => x.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (word.length - 1);
    let px = 128 - total / 2;
    [...word].forEach((ch, i) => { x.textAlign = 'left'; x.fillText(ch, px, 122); px += widths[i] + gap; });
    x.lineWidth = 1.5; x.beginPath(); x.moveTo(84, 146); x.lineTo(172, 146); x.stroke();
    return c;
  }

  class Chawan3D {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.manual = !!opts.manual;            // true: chỉ vẽ khi gọi shot() (dùng để chụp ảnh nhỏ)
      this.homePitch = opts.pitch != null ? opts.pitch : 0.32;
      this.autoSpin = opts.autoSpin != null ? opts.autoSpin : 0.3;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.autoSpin = 0;
      this.yaw = opts.yaw != null ? opts.yaw : -0.5;
      this.pitch = this.targetPitch = this.homePitch;
      this.spin = this.autoSpin;
      this.matcha = false;
      this.visible = true; this.dirty = true;
      this.glaze = null; this.hasPat = 0; this._patCanvas = null;
      this.profile = Prof.build(10);
      this.bandY0 = Prof.SPEC.band.center - Prof.SPEC.band.height * 0.62;   // texture cao ~24.6 mm
      this.bandH = Prof.SPEC.band.height * 1.37;
      this.matchaY = 3.4;
      this.matchaR = Prof.innerRadiusAt(this.profile, this.matchaY) - 0.03;

      const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
      if (!gl) throw new Error('WebGL không khả dụng');
      this.gl = gl;
      this._init();
      if (this.manual) return;
      this._bind();
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this._lost = true; });
      canvas.addEventListener('webglcontextrestored', () => { this._lost = false; this._init(); this.dirty = true; });

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; if (this.visible) this.start(); }, { threshold: 0.01 });
        this._io.observe(canvas);
      }
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.start(); });
      this.start();
    }

    /** Chụp một khung hình PNG nền trong suốt (size × size). st: { yaw, pitch, matcha } */
    shot(size, st) {
      const keep = { yaw: this.yaw, pitch: this.pitch, matcha: this.matcha };
      this.yaw = st.yaw != null ? st.yaw : this.yaw;
      this.pitch = st.pitch != null ? st.pitch : this.pitch;
      this.matcha = !!st.matcha;
      this.render(size);
      const url = this.canvas.toDataURL('image/png');
      this.yaw = keep.yaw; this.pitch = keep.pitch; this.matcha = keep.matcha;
      return url;
    }

    destroy() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._io) this._io.disconnect();
      const ext = this.gl && this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }

    _init() {
      const gl = this.gl;
      this.bowl = program(gl, VS_BOWL, FS_BOWL);
      this.disc = program(gl, VS_DISC, FS_DISC);

      // lưới thân bát
      const N = 96, S = this.profile.samples, W = N + 1;
      const pos = [], nrm = [], meta = [], idx = [];
      for (let j = 0; j < S.length; j++) {
        const p = S[j];
        for (let i = 0; i <= N; i++) {
          const u = i / N, th = u * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
          pos.push(p.r * c, p.y, p.r * s);
          nrm.push(p.nr * c, p.ny, p.nr * s);
          meta.push(1 - u, p.s, p.part);        // 1-u: họa tiết đọc trái → phải khi nhìn từ ngoài
        }
      }
      for (let j = 0; j < S.length - 1; j++) for (let i = 0; i < N; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const buf = (data, Type, target) => {
        const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, new Type(data), gl.STATIC_DRAW); return b;
      };
      this.vbPos = buf(pos, Float32Array, gl.ARRAY_BUFFER);
      this.vbNrm = buf(nrm, Float32Array, gl.ARRAY_BUFFER);
      this.vbMeta = buf(meta, Float32Array, gl.ARRAY_BUFFER);
      this.ib = buf(idx, Uint16Array, gl.ELEMENT_ARRAY_BUFFER);
      this.idxCount = idx.length;

      // đĩa đơn vị (bóng đổ + mặt matcha)
      const fan = [0, 0, 0]; const seg = 64;
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; fan.push(Math.cos(a), 0, Math.sin(a)); }
      this.vbDisc = buf(fan, Float32Array, gl.ARRAY_BUFFER);
      this.discCount = seg + 2;

      // texture
      this._aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      const tex = (el, wrapS) => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
        gl.generateMipmap(gl.TEXTURE_2D);     // tất cả texture ở đây đều là lũy thừa của 2
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (this._aniso) gl.texParameterf(gl.TEXTURE_2D, this._aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this._aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        return t;
      };
      const blank = document.createElement('canvas'); blank.width = 4; blank.height = 4;
      this.texPat = tex(this._patCanvas || blank, gl.REPEAT);
      this.texLogo = tex(logoCanvas(), gl.CLAMP_TO_EDGE);
      if (this.glaze) this.setGlaze(this.glaze);
    }

    setGlaze(g) { this.glaze = g; this.dirty = true; }

    /** canvas: tấm họa tiết 4096×256 (hoặc null nếu trơn) */
    setPattern(canvas) {
      const gl = this.gl;
      this._patCanvas = canvas;
      this.hasPat = canvas ? 1 : 0;
      if (canvas && !this._lost) {
        gl.bindTexture(gl.TEXTURE_2D, this.texPat);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      this.dirty = true;
    }
    // Bật matcha: nâng góc nhìn lên để thấy mặt trà trong lòng bát; xem đáy: lật camera xuống dưới
    setMatcha(on) { this.matcha = !!on; this._look(); }
    setFlipped(on) { this.flipped = !!on; this._look(); }
    _look() { this.targetPitch = this.flipped ? -1.2 : (this.matcha ? 0.78 : this.homePitch); this.dirty = true; }

    _bind() {
      const c = this.canvas;
      c.style.touchAction = 'pan-y';
      c.tabIndex = 0;
      c.addEventListener('pointerdown', e => {
        this.drag = { x: e.clientX, y: e.clientY };
        try { c.setPointerCapture(e.pointerId); } catch (_) { }
        this.spin = 0; c.classList.add('is-grabbing');
      });
      c.addEventListener('pointermove', e => {
        if (!this.drag) return;
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        this.yaw += dx * 0.009; this._lastDx = dx * 0.009 * 60;
        this.pitch = clamp(this.pitch + dy * 0.006, -1.3, 1.0);
        this.targetPitch = this.pitch; this.dirty = true;
      });
      const end = () => {
        if (!this.drag) return;
        this.drag = null; c.classList.remove('is-grabbing');
        this.spin = clamp(this._lastDx || 0, -4, 4); this._lastDx = 0;
      };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      c.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { this.yaw -= 0.15; this.dirty = true; }
        if (e.key === 'ArrowRight') { this.yaw += 0.15; this.dirty = true; }
        if (e.key === 'ArrowUp') { this.targetPitch = clamp(this.targetPitch - 0.1, -1.3, 1.0); this.dirty = true; }
        if (e.key === 'ArrowDown') { this.targetPitch = clamp(this.targetPitch + 0.1, -1.3, 1.0); this.dirty = true; }
      });
    }

    start() {
      if (this._raf || !this.visible) return;
      this._last = performance.now();
      const tick = t => {
        this._raf = 0;
        if (!this.visible || document.hidden) return;
        this.frame(t);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    frame(t) {
      const dt = Math.min(0.05, Math.max(0, (t - this._last) / 1000)); this._last = t;
      if (this._lost) return;
      if (!this.drag) {
        this.spin += (this.autoSpin - this.spin) * (1 - Math.exp(-dt * 1.4));
        if (Math.abs(this.spin) > 1e-4) { this.yaw += this.spin * dt; this.dirty = true; }
        const dp = this.targetPitch - this.pitch;
        if (Math.abs(dp) > 1e-3) { this.pitch += dp * (1 - Math.exp(-dt * 4.5)); this.dirty = true; }
      }
      if (this.dirty) { this.dirty = false; this.render(); }
    }

    render(fixedSize) {
      const gl = this.gl, c = this.canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = fixedSize || Math.max(2, Math.round(c.clientWidth * dpr)), h = fixedSize || Math.max(2, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const asp = w / h, fov = 26 * Math.PI / 180, cy = 3.5;
      const t = Math.tan(fov / 2);
      const dist = Math.max(12.2 / 2 / t, 15.0 / 2 / (t * asp));
      const proj = M.persp(fov, asp, 5, 120);
      const view = M.mul(M.mul(M.trans(0, 0, -dist), M.rotX(this.pitch)), M.trans(0, -cy, 0));
      const vp = M.mul(proj, view);
      const model = M.rotY(this.yaw);
      const cam = [0, cy + dist * Math.sin(this.pitch), dist * Math.cos(this.pitch)];

      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // 1) bóng đổ
      const D = this.disc, fade = clamp((this.pitch + 0.15) / 0.35, 0, 1);
      gl.useProgram(D.p);
      gl.disable(gl.DEPTH_TEST);
      this._attrDisc(D);
      gl.uniformMatrix4fv(D.loc.uVP, false, vp);
      gl.uniformMatrix4fv(D.loc.uModel, false, M.ident());
      gl.uniform1f(D.loc.uScale, 12); gl.uniform1f(D.loc.uY, -0.01);
      gl.uniform1f(D.loc.uMode, 0); gl.uniform1f(D.loc.uFade, fade); gl.uniform1f(D.loc.uR, 1);
      gl.uniform3fv(D.loc.uCam, cam);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, this.discCount);

      // 2) thân bát
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      const B = this.bowl, g = this.glaze || {};
      gl.useProgram(B.p);
      this._attrBowl(B);
      gl.uniformMatrix4fv(B.loc.uVP, false, vp);
      gl.uniformMatrix4fv(B.loc.uModel, false, model);
      gl.uniform3fv(B.loc.uCam, cam);
      gl.uniform3fv(B.loc.uBase, g.base || [0.9, 0.88, 0.82]);
      gl.uniform3fv(B.loc.uDeep, g.deep || [0.8, 0.76, 0.68]);
      gl.uniform3fv(B.loc.uInner, g.inner || g.base || [0.92, 0.9, 0.85]);
      gl.uniform3fv(B.loc.uSpeckCol, g.speckCol || [0.4, 0.28, 0.2]);
      gl.uniform3fv(B.loc.uClay, g.clay || [0.74, 0.6, 0.46]);
      gl.uniform1f(B.loc.uGloss, g.gloss != null ? g.gloss : 0.9);
      gl.uniform1f(B.loc.uSpeck, g.speck || 0);
      gl.uniform1f(B.loc.uHasPat, this.hasPat);
      gl.uniform2f(B.loc.uBand, this.bandY0, this.bandH);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texPat); gl.uniform1i(B.loc.uPat, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texLogo); gl.uniform1i(B.loc.uLogo, 1);
      gl.drawElements(gl.TRIANGLES, this.idxCount, gl.UNSIGNED_SHORT, 0);

      // 3) matcha
      if (this.matcha) {
        gl.useProgram(D.p);
        this._attrDisc(D);
        gl.uniformMatrix4fv(D.loc.uVP, false, vp);
        gl.uniformMatrix4fv(D.loc.uModel, false, model);
        gl.uniform1f(D.loc.uScale, this.matchaR); gl.uniform1f(D.loc.uY, this.matchaY);
        gl.uniform1f(D.loc.uMode, 1); gl.uniform1f(D.loc.uR, this.matchaR);
        gl.uniform3fv(D.loc.uCam, cam);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.discCount);
      }
    }

    _attrBowl(B) {
      const gl = this.gl;
      const bind = (name, buf, size) => {
        const l = gl.getAttribLocation(B.p, name);
        if (l < 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
      };
      bind('aPos', this.vbPos, 3); bind('aNrm', this.vbNrm, 3); bind('aMeta', this.vbMeta, 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    }
    _attrDisc(D) {
      const gl = this.gl, l = gl.getAttribLocation(D.p, 'aPos');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbDisc); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0);
    }
  }

  Chawan3D.hex = hex;
  root.Chawan3D = Chawan3D;
})(typeof self !== 'undefined' ? self : this);
