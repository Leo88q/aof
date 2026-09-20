/**
 * manorFx — тактильный слой дизайн-системы Manor:
 *  • звук по материалу (WebAudio-синтез, без файлов): wood / stone / metal / magic
 *  • хаптика (navigator.vibrate) с разной интенсивностью
 *  • волна свечения от точки нажатия
 *  • частицы: пылинки в свете, светлячки, золотые искры при действиях (≤ 100 одновременно)
 *
 * Подключение: initManorFx() один раз в main.tsx.
 * Материал элемента задаётся атрибутом data-material="wood|stone|metal|magic";
 * без атрибута — по классу (.btn-primary → wood, .mn-btn-secondary → metal,
 * .mn-icon-btn → stone, .toggle → metal, .mn-check/.mn-radio → magic).
 * Пользовательские настройки: localStorage manor.sound = "0|1", manor.motion = "0|1".
 */

type Material = "wood" | "stone" | "metal" | "magic";

const PARTICLE_CAP = 100;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const prefs = {
  get sound() { return localStorage.getItem("manor.sound") !== "0"; },
  set sound(v: boolean) { localStorage.setItem("manor.sound", v ? "1" : "0"); },
  get motion() {
    if (localStorage.getItem("manor.motion") === "0") return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },
  set motion(v: boolean) { localStorage.setItem("manor.motion", v ? "1" : "0"); document.documentElement.dataset.motion = v ? "on" : "off"; },
};

function audio(): AudioContext | null {
  if (!prefs.sound) return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx!.createGain();
    master.gain.value = 0.35;
    master.connect(ctx!.destination);
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function noise(ac: AudioContext, seconds: number): AudioBufferSourceNode {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(ac: AudioContext, g: GainNode, peak: number, attack: number, decay: number) {
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Уникальный звук для каждого материала. */
export function playMaterial(m: Material) {
  const ac = audio();
  if (!ac || !master) return;
  const out = master;
  switch (m) {
    case "wood": { // глухой тёплый стук + короткий щелчок
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(140, ac.currentTime); o.frequency.exponentialRampToValueAtTime(55, ac.currentTime + .12);
      env(ac, g, .9, .004, .16); o.connect(g).connect(out); o.start(); o.stop(ac.currentTime + .2);
      const n = noise(ac, .05); const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; const ng = ac.createGain();
      env(ac, ng, .35, .002, .05); n.connect(f).connect(ng).connect(out); n.start();
      break;
    }
    case "stone": { // звонкий холодный удар
      [1180, 1770, 2650].forEach((hz, i) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = "sine"; o.frequency.value = hz; env(ac, g, .28 / (i + 1), .002, .35 - i * .08);
        o.connect(g).connect(out); o.start(); o.stop(ac.currentTime + .5);
      });
      break;
    }
    case "metal": { // лязг: шум через полосовой фильтр + металлический обертон
      const n = noise(ac, .12); const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 6; const ng = ac.createGain();
      env(ac, ng, .5, .002, .12); n.connect(f).connect(ng).connect(out); n.start();
      const o = ac.createOscillator(); const g = ac.createGain(); o.type = "triangle"; o.frequency.value = 2380; env(ac, g, .18, .002, .28);
      o.connect(g).connect(out); o.start(); o.stop(ac.currentTime + .35);
      break;
    }
    case "magic": { // мягкий шёпот-шиммер: три квинты с медленной атакой
      [523.25, 783.99, 1046.5].forEach((hz, i) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = "sine"; o.frequency.value = hz; env(ac, g, .12, .05 + i * .03, .6);
        o.connect(g).connect(out); o.start(); o.stop(ac.currentTime + .9);
      });
      break;
    }
  }
}

/** Хаптика: дерево — мягко, металл — чётко, ошибка — двойной удар. */
export function haptic(kind: Material | "error" = "wood") {
  const v = (navigator as any).vibrate?.bind(navigator);
  if (!v) return;
  const pattern = { wood: [12], stone: [8], metal: [6, 30, 6], magic: [4, 40, 4, 40, 4], error: [30, 60, 30] }[kind];
  v(pattern);
}

/** Волна свечения от точки нажатия. */
export function ripple(target: HTMLElement, x: number, y: number) {
  if (!prefs.motion) return;
  const r = document.createElement("span");
  r.className = "mn-ripple";
  const size = Math.max(target.offsetWidth, target.offsetHeight) * 1.6;
  const rect = target.getBoundingClientRect();
  Object.assign(r.style, { width: `${size}px`, height: `${size}px`, left: `${x - rect.left}px`, top: `${y - rect.top}px` });
  const pos = getComputedStyle(target).position;
  if (pos === "static") target.style.position = "relative";
  target.appendChild(r);
  r.addEventListener("animationend", () => r.remove(), { once: true });
}

/** Error: дрожь + красное свечение. */
export function shake(el: HTMLElement) {
  el.classList.remove("mn-shake"); void el.offsetWidth; el.classList.add("mn-shake");
  el.addEventListener("animationend", () => el.classList.remove("mn-shake"), { once: true });
  haptic("error"); playMaterial("stone");
}

// ---------- частицы ----------
type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: "dust" | "fly" | "spark" | "leaf" | "snow"; hue: number };
let canvas: HTMLCanvasElement | null = null;
let c2d: CanvasRenderingContext2D | null = null;
let particles: P[] = [];
let raf = 0;
let season: "spring" | "summer" | "autumn" | "winter" = "summer";

export function setSeason(s: typeof season) { season = s; }

function spawnAmbient() {
  if (particles.length >= PARTICLE_CAP) return;
  const w = innerWidth, h = innerHeight;
  const r = Math.random();
  if (r < 0.55) particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .15, vy: -.05 - Math.random() * .1, life: 0, max: 600 + Math.random() * 400, size: .6 + Math.random() * 1.2, kind: "dust", hue: 45 });
  else if (r < 0.8) particles.push({ x: Math.random() * w, y: h * .4 + Math.random() * h * .6, vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .3, life: 0, max: 400 + Math.random() * 300, size: 1.4 + Math.random(), kind: "fly", hue: 60 + Math.random() * 40 });
  else if (season === "autumn") particles.push({ x: Math.random() * w, y: -10, vx: .3 + Math.random() * .5, vy: .6 + Math.random() * .6, life: 0, max: 900, size: 3 + Math.random() * 3, kind: "leaf", hue: 20 + Math.random() * 25 });
  else if (season === "winter") particles.push({ x: Math.random() * w, y: -10, vx: (Math.random() - .5) * .3, vy: .4 + Math.random() * .5, life: 0, max: 1200, size: 1.2 + Math.random() * 1.8, kind: "snow", hue: 220 });
}

/** Золотые искры от точки действия (металл — искры, дерево — золотая пыль). */
export function sparks(x: number, y: number, n = 14, material: Material = "magic") {
  if (!prefs.motion) return;
  for (let i = 0; i < n && particles.length < PARTICLE_CAP; i++) {
    const a = Math.random() * Math.PI * 2, s = material === "metal" ? 2 + Math.random() * 3 : .6 + Math.random() * 1.6;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (material === "metal" ? 1 : .3), life: 0, max: material === "metal" ? 30 + Math.random() * 20 : 60 + Math.random() * 40, size: material === "metal" ? 1.2 : 1 + Math.random() * 1.5, kind: "spark", hue: material === "metal" ? 35 : 48 });
  }
}

function tick() {
  if (!canvas || !c2d) return;
  const w = canvas.width = innerWidth * devicePixelRatio, h = canvas.height = innerHeight * devicePixelRatio;
  const g = c2d; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.clearRect(0, 0, w, h);
  if (Math.random() < .3) spawnAmbient();
  particles = particles.filter(p => p.life++ < p.max && p.y < innerHeight + 20 && p.y > -30);
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.kind === "fly") { p.vx += (Math.random() - .5) * .05; p.vy += (Math.random() - .5) * .05; }
    if (p.kind === "spark") { p.vy += .06; p.vx *= .98; }
    if (p.kind === "leaf") { p.vx = .3 + Math.sin(p.life / 25) * .6; }
    const t = p.life / p.max, fade = t < .15 ? t / .15 : t > .7 ? (1 - t) / .3 : 1;
    const flicker = p.kind === "fly" ? .5 + .5 * Math.sin(p.life / 9 + p.x) : 1;
    g.globalAlpha = Math.max(0, Math.min(1, fade * flicker * (p.kind === "dust" ? .35 : .9)));
    g.fillStyle = `hsl(${p.hue} ${p.kind === "snow" ? 30 : 90}% ${p.kind === "leaf" ? 45 : 72}%)`;
    if (p.kind === "fly" || p.kind === "spark") { g.shadowBlur = 8; g.shadowColor = g.fillStyle; } else g.shadowBlur = 0;
    g.beginPath();
    if (p.kind === "leaf") g.ellipse(p.x, p.y, p.size, p.size * .55, p.life / 20, 0, Math.PI * 2); else g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  raf = requestAnimationFrame(tick);
}

function materialOf(el: HTMLElement): Material | null {
  const m = el.closest<HTMLElement>("[data-material]")?.dataset.material as Material | undefined;
  if (m) return m;
  if (el.closest(".btn-primary, .mn-btn-primary, .list-row, .tab-btn, .card[role=button]")) return "wood";
  if (el.closest(".mn-btn-secondary, .btn-secondary, .toggle, .mn-toggle, .wallet-pill")) return "metal";
  if (el.closest(".mn-icon-btn, input[type=range]")) return "stone";
  if (el.closest(".mn-check, .mn-radio, .btn-destructive")) return "magic";
  return null;
}

/** Единая точка подключения. */
export function initManorFx() {
  if (document.getElementById("mn-fx-canvas")) return;
  document.documentElement.dataset.motion = prefs.motion ? "on" : "off";
  if (prefs.motion) {
    canvas = document.createElement("canvas"); canvas.id = "mn-fx-canvas"; document.body.appendChild(canvas);
    c2d = canvas.getContext("2d");
    const mist = document.createElement("div"); mist.className = "mn-mist"; document.body.appendChild(mist);
    raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(tick); });
  }
  let pressTimer = 0;
  document.addEventListener("pointerdown", (e) => {
    const el = e.target as HTMLElement;
    const m = materialOf(el); if (!m) return;
    const host = (el.closest("button, a, label, .list-row, .card") as HTMLElement) || el;
    playMaterial(m); haptic(m); ripple(host, e.clientX, e.clientY);
    sparks(e.clientX, e.clientY, m === "metal" ? 10 : 6, m);
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => { host.classList.add("mn-longpress"); playMaterial("magic"); haptic("magic"); }, 550);
  }, { passive: true });
  const release = () => { clearTimeout(pressTimer); document.querySelectorAll(".mn-longpress").forEach(n => n.classList.remove("mn-longpress")); };
  document.addEventListener("pointerup", release, { passive: true });
  document.addEventListener("pointercancel", release, { passive: true });
}

export const manorPrefs = prefs;
