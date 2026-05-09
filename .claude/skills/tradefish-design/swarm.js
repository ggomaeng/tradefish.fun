// TradeFish — WebGL particle swarm.
// Plain script (not a module). Exposes window.TFSwarm.create(canvas, options) -> controller.
//
// Renders a flocking school of point-light particles using GPU instanced points.
// Each particle has a "school" id (0..N) — schools cluster around moving anchors.
// Caller can: setSchools, setAnchors, setCount, pulseAt, transitionTo (consensus
// coalesce), explode (the 6 → 60 → 600 → 60000 finale), setMode.
//
// Modes:
//   'idle'      — drift + flock
//   'schooling' — strong clustering toward anchors (one per agent)
//   'coalesce'  — all schools merge toward a single point (consensus)
//   'leaderboard' — anchors line up vertically (rank order)
//   'explode'   — count multiplies, particles burst outward, settle to galaxy

(function () {
  const VERT = `
    attribute vec2 a_pos;
    attribute float a_size;
    attribute vec3 a_color;
    attribute float a_alpha;
    uniform vec2 u_res;
    uniform float u_dpr;
    varying vec3 v_color;
    varying float v_alpha;
    void main() {
      vec2 ndc = (a_pos / u_res) * 2.0 - 1.0;
      ndc.y = -ndc.y;
      gl_Position = vec4(ndc, 0.0, 1.0);
      gl_PointSize = a_size * u_dpr;
      v_color = a_color;
      v_alpha = a_alpha;
    }
  `;
  const FRAG = `
    precision mediump float;
    varying vec3 v_color;
    varying float v_alpha;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;
      // Soft glow with hot core
      float core = smoothstep(0.5, 0.0, d);
      float glow = pow(core, 2.0);
      vec3 col = v_color * (0.4 + 1.6 * glow);
      gl_FragColor = vec4(col, v_alpha * core);
    }
  `;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // Convert a color name (CSS variable lookup) or hex/oklch string to RGB array.
  function resolveColor(input) {
    if (Array.isArray(input)) return input;
    if (typeof input !== 'string') return [0.6, 0.85, 1.0];
    if (input.startsWith('#')) return hexToRgb(input);
    if (input === 'orange') return [0.85, 0.47, 0.34];
    if (input === 'cream' || input === 'fish') return [0.94, 0.91, 0.88];
    if (input === 'cyan') return [0.66, 0.85, 0.91];
    // Use a temp element to compute oklch / var() colors.
    const tmp = document.createElement('div');
    tmp.style.color = input;
    document.body.appendChild(tmp);
    const cs = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    const m = cs.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(',').map(s => parseFloat(s));
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
    }
    return [0.85, 0.47, 0.34];
  }

  function create(canvas, opts = {}) {
    const gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false, alpha: true });
    if (!gl) { console.warn('WebGL unavailable'); return null; }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const a_pos = gl.getAttribLocation(prog, 'a_pos');
    const a_size = gl.getAttribLocation(prog, 'a_size');
    const a_color = gl.getAttribLocation(prog, 'a_color');
    const a_alpha = gl.getAttribLocation(prog, 'a_alpha');
    const u_res = gl.getUniformLocation(prog, 'u_res');
    const u_dpr = gl.getUniformLocation(prog, 'u_dpr');

    const posBuf = gl.createBuffer();
    const sizeBuf = gl.createBuffer();
    const colorBuf = gl.createBuffer();
    const alphaBuf = gl.createBuffer();

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u_res, W, H);
      gl.uniform1f(u_dpr, dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // State
    let count = opts.count ?? 1200;
    const MAX = opts.max ?? 80000;
    let mode = 'idle';
    let schools = []; // [{id, anchorX, anchorY, color, weight, radius}]
    let bg = opts.background || [0.020, 0.040, 0.080, 1.0];
    const DEFAULT_COLOR = opts.defaultColor || [0.94, 0.91, 0.88]; // pale cream

    // Per-particle arrays (Float32 throughout)
    const px = new Float32Array(MAX);
    const py = new Float32Array(MAX);
    const vx = new Float32Array(MAX);
    const vy = new Float32Array(MAX);
    const sId = new Int32Array(MAX);     // school index
    const sz = new Float32Array(MAX);
    const col = new Float32Array(MAX * 3);
    const alpha = new Float32Array(MAX);
    const life = new Float32Array(MAX);
    const ttl = new Float32Array(MAX);

    function rand(min, max) { return min + Math.random() * (max - min); }

    function spawn(i, schoolIdx = 0, x, y) {
      const s = schools[schoolIdx] || schools[0];
      const ax = (s && s.anchorX) ?? W * 0.5;
      const ay = (s && s.anchorY) ?? H * 0.5;
      const r = (s && s.radius) ?? 60;
      px[i] = x ?? ax + rand(-r, r);
      py[i] = y ?? ay + rand(-r, r);
      const ang = Math.random() * Math.PI * 2;
      const sp = rand(8, 26);
      vx[i] = Math.cos(ang) * sp;
      vy[i] = Math.sin(ang) * sp;
      sId[i] = schoolIdx;
      const c = (s && s.color) || DEFAULT_COLOR;
      col[i * 3 + 0] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      sz[i] = rand(1.6, 3.2);
      alpha[i] = rand(0.55, 0.95);
      life[i] = 0;
      ttl[i] = rand(8, 20);
    }

    function setSchools(newSchools) {
      // newSchools: [{id, x, y, color, weight, radius}]
      schools = newSchools.map((s, i) => ({
        id: s.id ?? i,
        anchorX: s.x,
        anchorY: s.y,
        color: resolveColor(s.color),
        weight: s.weight ?? 1,
        radius: s.radius ?? 50,
      }));
      // Distribute particles across schools by weight
      const totalW = schools.reduce((a, b) => a + b.weight, 0) || 1;
      let assigned = 0;
      for (let s = 0; s < schools.length; s++) {
        const target = Math.round((schools[s].weight / totalW) * count);
        for (let k = 0; k < target && assigned < count; k++, assigned++) {
          spawn(assigned, s);
        }
      }
      // Any leftover go to first school
      while (assigned < count) { spawn(assigned, 0); assigned++; }
    }

    function setCount(n) {
      n = Math.min(MAX, Math.max(0, n | 0));
      if (n > count) {
        for (let i = count; i < n; i++) {
          const sIdx = Math.floor(Math.random() * Math.max(1, schools.length));
          spawn(i, sIdx);
        }
      }
      count = n;
    }

    function setMode(m) { mode = m; }

    function pulseAt(x, y, strength = 600) {
      for (let i = 0; i < count; i++) {
        const dx = px[i] - x, dy = py[i] - y;
        const d2 = dx * dx + dy * dy + 30;
        const f = strength / d2;
        vx[i] += dx * f;
        vy[i] += dy * f;
      }
    }

    let coalesceTarget = null; // {x, y}
    function coalesce(x, y) { coalesceTarget = { x, y }; mode = 'coalesce'; }
    function uncoalesce() { coalesceTarget = null; mode = 'schooling'; }

    let last = performance.now();
    let running = true;

    function step(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Per-particle simulation — fish-school motion: alignment, sway, dart
      const swayPhase = now * 0.0018;
      for (let i = 0; i < count; i++) {
        const sIdx = sId[i];
        const s = schools[sIdx] || schools[0];
        const ax = (mode === 'coalesce' && coalesceTarget) ? coalesceTarget.x : (s ? s.anchorX : W / 2);
        const ay = (mode === 'coalesce' && coalesceTarget) ? coalesceTarget.y : (s ? s.anchorY : H / 2);

        // Anchor attraction — tighter for fish-school cohesion
        let kx = 0.5, ky = 0.5;
        if (mode === 'idle') { kx = 0.14; ky = 0.14; }
        else if (mode === 'schooling') { kx = 1.2; ky = 1.2; }
        else if (mode === 'coalesce') { kx = 1.6; ky = 1.6; }
        else if (mode === 'leaderboard') { kx = 1.8; ky = 1.8; }
        else if (mode === 'explode') { kx = 0.04; ky = 0.04; }

        const dx = ax - px[i], dy = ay - py[i];
        vx[i] += dx * kx * dt;
        vy[i] += dy * ky * dt;

        // Swirl — gentler so school looks like swimming, not orbiting
        if (mode !== 'explode') {
          vx[i] += -dy * 0.35 * dt;
          vy[i] +=  dx * 0.35 * dt;
        }

        // Fish tail sway — perpendicular wiggle to direction of motion
        const speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]) + 0.001;
        const nx = -vy[i] / speed, ny = vx[i] / speed;
        const wig = Math.sin(swayPhase + i * 0.7) * 18 * dt;
        vx[i] += nx * wig;
        vy[i] += ny * wig;

        // Damping
        const damp = mode === 'explode' ? 0.98 : 0.93;
        vx[i] *= Math.pow(damp, dt * 60);
        vy[i] *= Math.pow(damp, dt * 60);

        // Tiny noise
        vx[i] += (Math.random() - 0.5) * 4 * dt;
        vy[i] += (Math.random() - 0.5) * 4 * dt;

        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;

        // Bounds wrap (gentle)
        if (px[i] < -40) px[i] = W + 40;
        else if (px[i] > W + 40) px[i] = -40;
        if (py[i] < -40) py[i] = H + 40;
        else if (py[i] > H + 40) py[i] = -40;

        // Subtle alpha shimmer
        const shimmer = 0.78 + 0.22 * Math.sin(now * 0.003 + i);
        alpha[i] = Math.min(1, 0.55 + 0.4 * shimmer);

        life[i] += dt;
      }

      // Draw
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive

      // Pack positions
      const posArr = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) { posArr[i * 2] = px[i]; posArr[i * 2 + 1] = py[i]; }
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_pos);
      gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, sz.subarray(0, count), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_size);
      gl.vertexAttribPointer(a_size, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, col.subarray(0, count * 3), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_color);
      gl.vertexAttribPointer(a_color, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
      gl.bufferData(gl.ARRAY_BUFFER, alpha.subarray(0, count), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(a_alpha);
      gl.vertexAttribPointer(a_alpha, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, count);

      requestAnimationFrame(step);
    }

    // Default schools
    setSchools([{ id: 0, x: () => W / 2, y: () => H / 2, color: '#7fd5ff', weight: 1, radius: 220 }]);
    requestAnimationFrame(step);

    return {
      setSchools,
      setCount,
      setMode,
      pulseAt,
      coalesce,
      uncoalesce,
      get count() { return count; },
      get size() { return { W, H }; },
      destroy() { running = false; ro.disconnect(); },
    };
  }

  window.TFSwarm = { create, resolveColor };
})();
