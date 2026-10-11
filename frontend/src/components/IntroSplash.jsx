import React, { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// OPENING ANIMATION - BMW-style roundel reveal of the OTC Tech Solutions logo.
// The sound is YOUR audio file (public/brand/sound/otc-logo-intro-v6.mp3, 4.05 s)
// and every move is timed to it:
//
//   0.00  black, the sound starts to swell        0.15-1.65  the neon ring is drawn
//   0.70-2.0  the logo opens from the centre like an iris (follows the swell)
//   1.97  the sound peaks: flash + shockwave + star flare
//   1.9-3.0  chrome light glides over the logo    2.15-2.75  exact logo picture settles in
//   3.7   fade into the app (the sound has faded out by 4.05)
//
// The logo picture itself (brand/intro-v6/full.jpg) is shown exactly as it is.
// It starts when you TAP / click / press a key (browsers only allow sound after
// that), so picture and sound always start together.
// ---------------------------------------------------------------------------

const BASE = '/brand/intro-v6/';
const SND = '/brand/sound/otc-logo-intro-v6.mp3?v=6';
const IMG = 1254;
const CX = 618.7, CY = 625.0, R = 469.0;           // neon ring, in image pixels
const RB = [55, 62, 1128, 1127];                   // ring layer box
const RESTB = [2, 2, 1250, 1250];                  // rest layer box
const PEAK = 1.97;                                 // loudest moment of the sound
const TOTAL = 3.7;                                 // fade-out starts
const END = 4.5;                                   // hand over to the app

// loudness of the sound file every 0.1 s (0..1) - the glow follows it
const ENV = [0.007,0.014,0.023,0.036,0.060,0.084,0.107,0.135,0.160,0.185,0.223,0.280,0.364,0.482,0.592,0.611,0.585,0.643,0.793,0.934,0.915,0.733,0.563,0.431,0.310,0.240,0.205,0.169,0.130,0.096,0.074,0.056,0.044,0.036,0.026,0.019,0.014,0.009,0.004,0.002];
const level = (t) => { const p = Math.max(0, t) * 10, i = Math.floor(p), f = p - i; return (ENV[i] ?? 0) * (1 - f) + (ENV[i + 1] ?? 0) * f; };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (p) => p * p * (3 - 2 * p);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const pct = (v) => `${((v / IMG) * 100).toFixed(3)}%`;

export default function IntroSplash({ onDone }) {
  const stageRef = useRef(null);
  const restRef = useRef(null);
  const ringA = useRef(null);
  const ringB = useRef(null);
  const fullRef = useRef(null);
  const sheenRef = useRef(null);
  const hazeRef = useRef(null);
  const flashRef = useRef(null);
  const flareRef = useRef(null);
  const sparkR = useRef(null);
  const sparkL = useRef(null);
  const fxRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [closing, setClosing] = useState(false);
  const api = useRef({});

  useEffect(() => {
    let cancelled = false, finished = false, raf = 0;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    let actx = null;
    try { if (Ctx) actx = new Ctx(); } catch { actx = null; }
    const st = { began: false, useAudio: false, t0: 0, p0: 0, closed: false, shake: 0, flash: 0 };
    const fired = {}; const once = (k, c, f) => { if (c && !fired[k]) { fired[k] = true; f(); } };
    const setMask = (e, css) => { if (!e) return; e.style.webkitMaskImage = css; e.style.maskImage = css; };

    // ---- load + decode the sound while the "tap to start" screen is showing ----
    let buf = null;
    const bufP = (async () => {
      if (!actx) return;
      try {
        const res = await fetch(SND);
        const ab = await res.arrayBuffer();
        buf = await actx.decodeAudioData(ab);
        console.info('[intro] sound ready', buf.duration.toFixed(2) + 's');
      } catch (e) { console.warn('[intro] sound could not be loaded', e); }
    })();

    // ---- effects canvas: shockwaves + sparks ----
    const fx = fxRef.current, fctx = fx.getContext('2d');
    const geo = { w: 0, h: 0, s: 0, left: 0, top: 0, dpr: 1 };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      geo.dpr = dpr; geo.w = window.innerWidth; geo.h = window.innerHeight;
      fx.width = Math.floor(geo.w * dpr); fx.height = Math.floor(geo.h * dpr);
      geo.s = Math.min(geo.w, geo.h); geo.left = (geo.w - geo.s) / 2; geo.top = (geo.h - geo.s) / 2;
    };
    resize(); window.addEventListener('resize', resize);
    const mkDot = (rgb) => { const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.4, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return c; };
    const dots = [mkDot('255,255,255'), mkDot('140,200,255'), mkDot('150,255,170'), mkDot('190,150,255')];
    const parts = [], rings = []; let lastNow = performance.now();
    const px = (ix) => geo.left + (ix / IMG) * geo.s, py = (iy) => geo.top + (iy / IMG) * geo.s;
    const spawn = (x, y, vx, vy, life, size, kind) => { if (parts.length < 260) parts.push({ x, y, vx, vy, life, max: life, size, kind }); };
    const burst = (n, sp) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.25 + Math.random()); spawn(px(CX), py(CY), Math.cos(a) * v, Math.sin(a) * v, 0.9 + Math.random() * 1.1, 3 + Math.random() * 6, (Math.random() * 4) | 0); } };

    const drawFx = (dt) => {
      const { w, h, dpr } = geo;
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.clearRect(0, 0, w, h);
      fctx.globalCompositeOperation = 'lighter';
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.t += dt; if (r.t > r.life) { rings.splice(i, 1); continue; }
        const k = r.t / r.life;
        fctx.globalAlpha = (1 - k) * 0.8; fctx.strokeStyle = r.col; fctx.lineWidth = 2 + (1 - k) * 8;
        fctx.beginPath(); fctx.arc(px(CX), py(CY), (R / IMG + easeOut(k) * r.max) * geo.s, 0, 6.283); fctx.stroke();
      }
      fctx.globalAlpha = 1;
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - 0.8 * dt; q.vy *= 1 - 0.8 * dt; q.vy += 24 * dt;
        const k = clamp(q.life / q.max); fctx.globalAlpha = Math.min(1, k * 1.6);
        const sz = q.size * (0.6 + 0.6 * k) * (geo.s / 900 + 0.4);
        fctx.drawImage(dots[q.kind], q.x - sz, q.y - sz, sz * 2, sz * 2);
      }
      fctx.globalAlpha = 1;
    };

    const rcx = (((CX - RB[0]) / RB[2]) * 100).toFixed(3), rcy = (((CY - RB[1]) / RB[3]) * 100).toFixed(3);

    const scene = (t) => {
      const lv = level(t);                          // loudness of the sound right now
      // ---- camera: slow 3-D swing + push-in, like a badge being revealed ----
      const swing = 24 * (1 - easeOut(prog(t, 0.15, 2.2))) + (t > 2.2 ? 1.2 * Math.sin(t * 1.5) : 0);
      const cam = 1.1 - 0.1 * easeOut(prog(t, 0.1, 3.0));
      if (stageRef.current) {
        const sh = st.shake;
        stageRef.current.style.transform = `translate(${((Math.random() - 0.5) * sh).toFixed(1)}px,${((Math.random() - 0.5) * sh).toFixed(1)}px) perspective(1500px) rotateY(${swing.toFixed(2)}deg) scale(${cam.toFixed(4)})`;
      }
      // ---- neon ring is drawn from the top down both sides ----
      const a = 186 * smooth(prog(t, 0.15, 1.65));
      const rb = 0.75 + 0.9 * lv;
      const hue = t > 2.2 ? `hue-rotate(${(8 * Math.sin(t * 1.4)).toFixed(1)}deg)` : '';
      [ringA.current, ringB.current].forEach((e) => { if (e) { e.style.opacity = a > 0.5 ? '1' : '0'; e.style.filter = `brightness(${rb.toFixed(3)}) ${hue}`; } });
      setMask(ringA.current, `conic-gradient(from 0deg at ${rcx}% ${rcy}%, #000 0deg, #000 ${Math.max(0, a - 5).toFixed(1)}deg, transparent ${a.toFixed(1)}deg, transparent 360deg)`);
      setMask(ringB.current, `conic-gradient(from 0deg at ${rcx}% ${rcy}%, transparent 0deg, transparent ${(360 - a).toFixed(1)}deg, #000 ${(365 - a).toFixed(1)}deg, #000 360deg)`);
      const th = (a * Math.PI) / 180, hv = a > 0.5 && a < 184;
      const hop = hv ? 1 : 0;
      if (sparkR.current) { sparkR.current.style.opacity = hop; sparkR.current.style.left = pct(CX + R * Math.sin(th)); sparkR.current.style.top = pct(CY - R * Math.cos(th)); }
      if (sparkL.current) { sparkL.current.style.opacity = hop; sparkL.current.style.left = pct(CX - R * Math.sin(th)); sparkL.current.style.top = pct(CY - R * Math.cos(th)); }
      if (hv && Math.random() < 0.7) {
        spawn(px(CX + R * Math.sin(th)), py(CY - R * Math.cos(th)), (Math.random() - 0.5) * 50, 15 + Math.random() * 40, 0.7, 3 + Math.random() * 3, 1);
        spawn(px(CX - R * Math.sin(th)), py(CY - R * Math.cos(th)), (Math.random() - 0.5) * 50, 15 + Math.random() * 40, 0.7, 3 + Math.random() * 3, 2);
      }
      // ---- the logo opens from the centre (iris), following the swell of the sound ----
      const r = 100 * smooth(prog(t, 0.7, 2.0));
      if (restRef.current) {
        restRef.current.style.opacity = r > 0.5 ? '1' : '0';
        restRef.current.style.filter = `brightness(${(0.15 + 0.85 * smooth(prog(t, 0.8, 2.1)) + 0.5 * Math.max(0, lv - 0.7)).toFixed(3)})`;
        setMask(restRef.current, r >= 99.5 ? 'none' : `radial-gradient(circle at 49% 50%, #000 ${Math.max(0, r - 26).toFixed(1)}%, transparent ${r.toFixed(1)}%)`);
      }
      // ---- glow behind follows the loudness ----
      if (hazeRef.current) hazeRef.current.style.opacity = (0.1 + 0.9 * lv).toFixed(3);
      // ---- the sound peaks: flash, shockwaves, sparks ----
      once('peak', t > PEAK, () => { st.shake = 16; st.flash = 0.6; rings.push({ t: 0, life: 1.2, max: 0.5, col: 'rgba(190,225,255,1)' }, { t: 0, life: 1.6, max: 0.85, col: 'rgba(150,255,190,.8)' }); burst(60, 330); });
      once('peak2', t > PEAK + 0.3, () => rings.push({ t: 0, life: 1.4, max: 0.7, col: 'rgba(200,170,255,.8)' }));
      if (flashRef.current) flashRef.current.style.opacity = clamp(st.flash).toFixed(3);
      // ---- star flare ----
      if (flareRef.current) {
        const f = t > 1.6 ? clamp(Math.sin(Math.PI * prog(t, 1.6, 3.2)) * 1.1 + (t > PEAK ? Math.exp(-(t - PEAK) * 3) * 0.6 : 0)) : 0;
        flareRef.current.style.opacity = f.toFixed(3);
        flareRef.current.style.transform = `translate(-50%,-50%) scale(${(0.5 + f * 0.8).toFixed(3)})`;
      }
      // ---- chrome light gliding over the logo ----
      if (sheenRef.current) {
        let c = 0, o = 0;
        if (t > 1.9 && t < 3.0) { c = -25 + smooth(prog(t, 1.9, 3.0)) * 150; o = Math.sin(Math.PI * prog(t, 1.9, 3.0)); }
        else if (t > 3.0 && t < 3.8) { c = 130 - smooth(prog(t, 3.0, 3.8)) * 160; o = 0.45 * Math.sin(Math.PI * prog(t, 3.0, 3.8)); }
        sheenRef.current.style.opacity = o.toFixed(3);
        setMask(sheenRef.current, `linear-gradient(105deg,transparent ${(c - 9).toFixed(1)}%,#000 ${c.toFixed(1)}%,transparent ${(c + 9).toFixed(1)}%)`);
      }
      // ---- the exact logo picture settles in on top, so the final result is your image untouched ----
      if (fullRef.current) fullRef.current.style.opacity = smooth(prog(t, 2.15, 2.75)).toFixed(3);
      // ---- rising sparkles after the peak ----
      if (t > 2.1 && t < 3.6 && Math.random() < 0.45) spawn(px(120 + Math.random() * 1010), py(950 + Math.random() * 170), (Math.random() - 0.5) * 14, -(24 + Math.random() * 40), 1.4 + Math.random() * 1.2, 2 + Math.random() * 3, 1 + ((Math.random() * 3) | 0));
    };

    const clock = () => (st.useAudio ? actx.currentTime - st.t0 : (performance.now() - st.p0) / 1000);
    const loop = () => {
      if (cancelled) return;
      const now = performance.now(); const dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
      st.shake *= Math.pow(0.02, dt); if (st.shake < 0.3) st.shake = 0;
      st.flash *= Math.pow(0.04, dt);
      if (st.began) {
        const t = Math.max(0, clock());
        scene(t); drawFx(dt);
        if (t >= TOTAL && !st.closed) { st.closed = true; setClosing(true); }
        if (t >= END) { finish(); return; }
      }
      raf = requestAnimationFrame(loop);
    };

    const evts = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const removeGestures = () => evts.forEach((e) => document.removeEventListener(e, onGesture, true));
    const finish = () => {
      if (finished) return; finished = true; cancelled = true;
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize); removeGestures();
      if (actx) { try { actx.close(); } catch { /* ignore */ } }
      onDone();
    };
    api.current.skip = () => {
      cancelled = true; cancelAnimationFrame(raf); setClosing(true);
      if (actx) { try { actx.suspend(); } catch { /* ignore */ } }
      setTimeout(finish, 450);
    };

    const begin = async () => {
      if (st.began || cancelled) return;
      st.began = true; setStarted(true); removeGestures();
      if (reduced) {
        if (fullRef.current) fullRef.current.style.opacity = '1';
        setTimeout(() => { setClosing(true); setTimeout(finish, 600); }, 2000);
        return;
      }
      // make sure the sound file is decoded, then start picture + sound on the same clock
      await Promise.race([bufP, new Promise((r) => setTimeout(r, 2500))]);
      if (cancelled) return;
      st.began = false;                       // (hold the animation until the sound is queued)
      if (actx && actx.state === 'running' && buf) {
        try {
          const src = actx.createBufferSource(); src.buffer = buf;
          const g = actx.createGain(); g.gain.value = 1.4;
          src.connect(g).connect(actx.destination);
          st.t0 = actx.currentTime + 0.1; src.start(st.t0); st.useAudio = true;
        } catch { st.useAudio = false; }
      }
      if (!st.useAudio) st.p0 = performance.now();
      st.began = true;
    };
    // the tap / click / key press that starts everything (also what lets the browser play sound)
    function onGesture() {
      if (st.began || st.pending) return;
      st.pending = true;
      const go = () => { st.pending = false; begin(); };
      if (actx && actx.state !== 'running') { actx.resume().then(go).catch(go); setTimeout(() => { if (st.pending) go(); }, 800); } else go();
    }
    evts.forEach((e) => document.addEventListener(e, onGesture, true));

    raf = requestAnimationFrame(loop);
    return () => { cancelled = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); removeGestures(); if (actx && !finished) { try { actx.close(); } catch { /* ignore */ } } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const box = (b) => ({ left: pct(b[0]), top: pct(b[1]), width: pct(b[2]), height: pct(b[3]) });
  return (
    <div className={'intro-splash' + (closing ? ' intro-out' : '')} aria-hidden="true">
      <div ref={hazeRef} className="intro-haze" />
      <div ref={stageRef} className="intro-stage">
        <div className="intro-edge">
          <img ref={restRef} src={`${BASE}rest.webp`} alt="" draggable="false" className="il il-rest" style={box(RESTB)} />
          <img ref={ringA} src={`${BASE}ring.webp`} alt="" draggable="false" className="il il-ring" style={box(RB)} />
          <img ref={ringB} src={`${BASE}ring.webp`} alt="" draggable="false" className="il il-ring" style={box(RB)} />
          <img ref={fullRef} src={`${BASE}full.jpg`} alt="" draggable="false" className="il il-full" />
          <img ref={sheenRef} src={`${BASE}full.jpg`} alt="" draggable="false" className="il il-sheen" />
        </div>
        <span ref={flareRef} className="intro-flare" style={{ left: pct(622), top: pct(170) }} />
        <span ref={sparkR} className="intro-spark spark-b" />
        <span ref={sparkL} className="intro-spark spark-g" />
      </div>
      <canvas ref={fxRef} className="intro-fx" />
      <div ref={flashRef} className="intro-flash" />
      {!started && (
        <div className="intro-gate">
          <img src={`${BASE}full.jpg`} alt="" className="intro-gate-art" draggable="false" />
          <div className="intro-gate-text">TAP ANYWHERE TO START</div>
          <div className="intro-gate-sub">&#128266; sound on</div>
        </div>
      )}
      {started && !closing && (
        <button type="button" className="intro-skip" onClick={(e) => { e.stopPropagation(); api.current.skip && api.current.skip(); }}>Skip &#9656;</button>
      )}
    </div>
  );
}
