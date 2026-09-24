'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { FastForward, HelpCircle, Pause, Play, RotateCcw, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const W = 420, CELL = 60, R = 6.5, SPEED = 620;
const SAVE_KEY = 'little-bounce-v1', BEST_KEY = 'little-bounce-best-v1', UNDO_KEY = 'little-bounce-undo-v1';
const PALETTE = [
  ['#f4bba9', '#d99685'], ['#d9c8eb', '#b6a0d1'], ['#bfe1cd', '#8fc4a5'],
  ['#f6e3a9', '#dcc37a'], ['#c8d9e9', '#a3bdd6'],
];
type Brick = { id: number; col: number; row: number; hp: number; color: number; pulse: number };
type Pickup = { id: number; col: number; row: number };
type Ball = { x: number; y: number; vx: number; vy: number; lastHit: number; hitWait: number; trail: { x: number; y: number }[] };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Snapshot = { round: number; count: number; launchX: number; bricks: Brick[]; pickups: Pickup[]; id: number };
type Phase = 'ready' | 'firing' | 'over';
type Game = {
  h: number; round: number; best: number; count: number; launchX: number; id: number;
  bricks: Brick[]; pickups: Pickup[]; balls: Ball[]; particles: Particle[];
  phase: Phase; paused: boolean; aiming: boolean; aimX: number; aimY: number; intro: boolean;
  launched: number; shotCount: number; clock: number; dx: number; dy: number; nextX: number | null; fast: boolean;
};
const floor = (g: Game) => g.h - 33;
const rect = (b: Brick) => ({ x: b.col * CELL + 4, y: 13 + b.row * CELL + 4, w: CELL - 8, h: CELL - 8 });
const center = (p: Pickup) => ({ x: p.col * CELL + 30, y: 43 + p.row * CELL });

function initial(h: number, best: number): Game {
  return { h, best, round: 1, count: 1, launchX: W / 2, id: 5,
    bricks: [{ id: 1, col: 1, row: 0, hp: 1, color: 0, pulse: 0 },
      { id: 2, col: 3, row: 0, hp: 2, color: 1, pulse: 0 },
      { id: 3, col: 5, row: 0, hp: 1, color: 2, pulse: 0 }],
    pickups: [{ id: 4, col: 4, row: 1 }], balls: [], particles: [],
    phase: 'ready', paused: false, aiming: false, aimX: W / 2 + 70, aimY: h / 2,
    intro: true, launched: 0, shotCount: 1, clock: 0, dx: 0, dy: -1, nextX: null, fast: false };
}
function load(h: number): Game {
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch {}
  const start = initial(h, best);
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved && Number.isInteger(saved.round) && saved.round > 0 && Number.isInteger(saved.count) && saved.count > 0 &&
      Array.isArray(saved.bricks) && Array.isArray(saved.pickups)) {
      return { ...start, round: saved.round, count: Math.min(999, saved.count),
        phase: saved.phase === 'over' ? 'over' : 'ready',
        launchX: Math.max(10, Math.min(W - 10, saved.launchX || W / 2)),
        bricks: saved.bricks.filter((b: Brick) => b.hp > 0 && b.col >= 0 && b.col < 7 && b.row >= 0 && b.row < 20),
        pickups: saved.pickups.filter((p: Pickup) => p.col >= 0 && p.col < 7 && p.row >= 0 && p.row < 20),
        id: saved.id || 5, intro: false };
    }
  } catch {}
  return start;
}
function save(g: Game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ round: g.round, count: g.count, launchX: g.launchX, phase: g.phase,
      bricks: g.bricks, pickups: g.pickups, id: g.id }));
    localStorage.setItem(BEST_KEY, String(g.best));
  } catch {}
}
function snapshot(g: Game): Snapshot {
  return { round: g.round, count: g.count, launchX: g.launchX,
    bricks: g.bricks.map((b) => ({ ...b, pulse: 0 })), pickups: g.pickups.map((p) => ({ ...p })), id: g.id };
}
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 15) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function burst(g: Game, x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n + Math.random() * .2, v = 65 + Math.random() * 85;
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .5, color });
  }
  if (g.particles.length > 90) g.particles.splice(0, g.particles.length - 90);
}
function launchOne(g: Game) {
  g.balls.push({ x: g.launchX, y: floor(g) - R - 1, vx: g.dx * SPEED, vy: g.dy * SPEED,
    lastHit: -1, hitWait: 0, trail: [] }); g.launched++;
}
function fire(g: Game) {
  if (g.phase !== 'ready' || g.paused) return;
  const x = g.aimX - g.launchX, y = Math.min(-65, g.aimY - floor(g));
  const d = Math.hypot(x, y) || 1;
  g.dx = Math.max(-.94, Math.min(.94, x / d)); g.dy = -Math.sqrt(1 - g.dx * g.dx);
  g.phase = 'firing'; g.intro = false; g.aiming = false; g.fast = false;
  g.launched = 0; g.shotCount = g.count; g.clock = 0; g.nextX = null; launchOne(g);
}
function nextRound(g: Game) {
  g.round++; g.best = Math.max(g.best, g.round);
  for (const b of g.bricks) b.row++;
  for (const p of g.pickups) p.row++;
  const used = new Set<number>();
  const target = Math.min(5, 2 + Math.floor(Math.random() * 3) + (g.round > 8 ? 1 : 0));
  while (used.size < target) used.add(Math.floor(Math.random() * 7));
  for (const col of used) g.bricks.push({ id: g.id++, col, row: 0,
    hp: Math.max(1, Math.round(g.round * (.72 + Math.random() * .72))),
    color: (col + g.round) % PALETTE.length, pulse: 0 });
  const free = [0, 1, 2, 3, 4, 5, 6].filter((c) => !used.has(c));
  if (free.length) g.pickups.push({ id: g.id++, col: free[Math.floor(Math.random() * free.length)], row: 0 });
  g.phase = g.bricks.some((b) => rect(b).y + rect(b).h >= floor(g) - 12) ? 'over' : 'ready';
  g.launchX = g.nextX ?? g.launchX; g.balls = []; g.fast = false; save(g);
}
function step(g: Game, dt: number, tone: (kind: 'hit' | 'pop' | 'pickup') => void) {
  if (g.paused || g.phase === 'over') return;
  for (const b of g.bricks) b.pulse = Math.max(0, b.pulse - dt * 3.5);
  for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; }
  g.particles = g.particles.filter((p) => p.life > 0);
  if (g.phase !== 'firing') return;
  g.clock += dt;
  if (g.launched < g.shotCount && g.clock >= .085) { g.clock -= .085; launchOne(g); }
  for (const ball of g.balls) {
    ball.hitWait = Math.max(0, ball.hitWait - dt);
    ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 4) ball.trail.shift();
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }
    if (ball.y + R >= floor(g)) {
      if (g.nextX === null) g.nextX = Math.max(R + 2, Math.min(W - R - 2, ball.x));
      ball.y = g.h + 100; continue;
    }
    for (const pick of g.pickups) {
      const p = center(pick);
      if (Math.hypot(ball.x - p.x, ball.y - p.y) < R + 17) {
        pick.row = -100; g.count++; burst(g, p.x, p.y, '#8dbfa0', 10); tone('pickup');
      }
    }
    for (const brick of g.bricks) {
      if (brick.hp <= 0 || (ball.lastHit === brick.id && ball.hitWait > 0)) continue;
      const b = rect(brick), cx = Math.max(b.x, Math.min(ball.x, b.x + b.w)), cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
      let nx = ball.x - cx, ny = ball.y - cy, dist = Math.hypot(nx, ny);
      if (dist >= R) continue;
      if (dist < .001) {
        const sides = [ball.x - b.x, b.x + b.w - ball.x, ball.y - b.y, b.y + b.h - ball.y];
        const closest = sides.indexOf(Math.min(...sides));
        nx = closest === 0 ? -1 : closest === 1 ? 1 : 0;
        ny = closest === 2 ? -1 : closest === 3 ? 1 : 0; dist = 0;
      } else { nx /= dist; ny /= dist; }
      ball.x += nx * (R - dist + 1); ball.y += ny * (R - dist + 1);
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) { ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny; }
      brick.hp--; brick.pulse = 1; ball.lastHit = brick.id; ball.hitWait = .06;
      if (brick.hp <= 0) {
        burst(g, b.x + b.w / 2, b.y + b.h / 2, PALETTE[brick.color][1], 8); tone('pop');
      } else tone('hit');
      break;
    }
  }
  g.bricks = g.bricks.filter((b) => b.hp > 0);
  g.pickups = g.pickups.filter((p) => p.row >= 0);
  g.balls = g.balls.filter((b) => b.y <= g.h);
  if (g.launched >= g.shotCount && g.balls.length === 0) nextRound(g);
}
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#bc9c9c44'; ctx.beginPath(); ctx.arc(x + 1, y + 2, r + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d39ea6'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffaf4'; ctx.beginPath(); ctx.arc(x, y - 1, r - .4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4d58'; ctx.beginPath(); ctx.arc(x - 2, y - 1, .8, 0, Math.PI * 2); ctx.arc(x + 2, y - 1, .8, 0, Math.PI * 2); ctx.fill();
}
function draw(g: Game, ctx: CanvasRenderingContext2D, now: number) {
  ctx.clearRect(0, 0, W, g.h);
  ctx.fillStyle = '#f3e8e0';
  for (let x = 30; x < W; x += 60) for (let y = 44; y < floor(g) - 25; y += 60) {
    ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  for (const brick of g.bricks) {
    const b = rect(brick), [fill, edge] = PALETTE[brick.color];
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(1 + brick.pulse * .06, 1 + brick.pulse * .06); ctx.translate(-b.w / 2, -b.h / 2);
    ctx.fillStyle = '#a584841c'; rounded(ctx, 1, 5, b.w, b.h); ctx.fill();
    ctx.fillStyle = edge; rounded(ctx, 0, 2, b.w, b.h - 1); ctx.fill();
    ctx.fillStyle = fill; rounded(ctx, 0, 0, b.w, b.h - 3); ctx.fill();
    ctx.fillStyle = '#ffffff66'; rounded(ctx, 7, 6, b.w - 14, 7, 4); ctx.fill();
    ctx.fillStyle = '#5a4d58'; ctx.font = `800 ${brick.hp >= 100 ? 19 : brick.hp >= 10 ? 22 : 25}px ui-rounded, 'Trebuchet MS', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(brick.hp), b.w / 2, b.h / 2 + 1);
    ctx.restore();
  }
  for (const pick of g.pickups) {
    const p = center(pick), pulse = 1 + Math.sin(now * .004 + pick.id) * .05;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#9ac9a7'; ctx.beginPath(); ctx.arc(0, 2, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9f0d8'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#76aa8b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#46765a'; ctx.font = "800 15px ui-rounded, 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+1', 0, 1); ctx.restore();
  }
  ctx.strokeStyle = '#e9d9d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(17, floor(g) + 1); ctx.lineTo(W - 17, floor(g) + 1); ctx.stroke();
  if (g.phase === 'ready' && !g.paused) {
    const ox = g.launchX, oy = floor(g) - R - 1;
    const tx = g.aiming ? g.aimX : ox + 70, ty = g.aiming ? g.aimY : oy - 240;
    const dx = tx - ox, dy = Math.min(-65, ty - floor(g)), d = Math.hypot(dx, dy) || 1;
    let vx = Math.max(-.94, Math.min(.94, dx / d)), vy = -Math.sqrt(1 - vx * vx), x = ox, y = oy;
    ctx.fillStyle = '#c6aeb2';
    for (let i = 0; i < 16; i++) {
      x += vx * 15; y += vy * 15;
      if (x < 8 || x > W - 8) { x = Math.max(8, Math.min(W - 8, x)); vx *= -1; }
      if (y < 8) break;
      ctx.globalAlpha = .75 - i * .032; ctx.beginPath(); ctx.arc(x, y, 3 - i * .06, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const ball of g.balls) {
    ball.trail.forEach((p, i) => { ctx.fillStyle = `rgba(214,171,173,${.08 + i * .06})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2 + i * .5, 0, Math.PI * 2); ctx.fill(); });
    drawBall(ctx, ball.x, ball.y, R);
  }
  if (g.phase === 'ready') drawBall(ctx, g.launchX, floor(g) - R - 1, R + 1);
  if (g.phase === 'firing' && g.nextX !== null) {
    ctx.fillStyle = '#d8b7b9'; ctx.beginPath(); ctx.arc(g.nextX, floor(g) - 5, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of g.particles) { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.fillStyle = '#967e86'; ctx.font = "800 16px ui-rounded, 'Trebuchet MS', sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const labelX = g.phase === 'firing' && g.nextX !== null ? g.nextX : g.launchX;
  ctx.fillText(`× ${g.count}`, Math.max(32, Math.min(W - 32, labelX)), floor(g) + 22);
}

export default function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null), gameRef = useRef<Game | null>(null);
  const audioRef = useRef<AudioContext | null>(null), lastSound = useRef(0), mutedRef = useRef(false);
  const undoRef = useRef<Snapshot | null>(null);
  const [hud, setHud] = useState({ round: 1, best: 0, count: 1, phase: 'ready' as Phase, paused: false, intro: true, fast: false });
  const [canUndo, setCanUndo] = useState(false);
  const [muted, setMuted] = useState(false), [help, setHelp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const sync = () => { const g = gameRef.current; if (g) setHud({ round: g.round, best: g.best, count: g.count,
    phase: g.phase, paused: g.paused, intro: g.intro, fast: g.fast }); };
  const tone = (kind: 'hit' | 'pop' | 'pickup') => {
    if (mutedRef.current || (kind === 'hit' && performance.now() - lastSound.current < 35)) return;
    lastSound.current = performance.now();
    try {
      audioRef.current ??= new AudioContext(); const audio = audioRef.current;
      if (audio.state === 'suspended') void audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      const hz = kind === 'pickup' ? 700 : kind === 'pop' ? 430 : 300;
      osc.type = kind === 'pickup' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(hz, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(hz * (kind === 'pickup' ? 1.5 : .75), audio.currentTime + .09);
      gain.gain.setValueAtTime(.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(kind === 'hit' ? .018 : .04, audio.currentTime + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .13);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .14);
    } catch {}
  };
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    let frameId = 0, previous = performance.now(), accumulator = 0;
    const resize = () => {
      const box = canvas.getBoundingClientRect(); if (!box.width || !box.height) return;
      const dpr = Math.min(devicePixelRatio || 1, 3);
      canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
      const h = box.height * W / box.width;
      if (!gameRef.current) {
        gameRef.current = load(h);
        try {
          const last = JSON.parse(localStorage.getItem(UNDO_KEY) || 'null');
          if (last && Number.isInteger(last.round) && Array.isArray(last.bricks) && Array.isArray(last.pickups)) {
            undoRef.current = last; setCanUndo(true);
          }
        } catch {}
      } else gameRef.current.h = h;
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / h, 0, 0); sync();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const tick = (now: number) => {
      const g = gameRef.current;
      if (g) {
        const before = `${g.round}:${g.count}:${g.phase}:${g.intro}`;
        accumulator += Math.min(.034, (now - previous) / 1000) * (g.fast ? 2.8 : 1);
        let n = 0; while (accumulator >= 1 / 120 && n < 14) { step(g, 1 / 120, tone); accumulator -= 1 / 120; n++; }
        if (n === 14) accumulator = 0;
        if (before !== `${g.round}:${g.count}:${g.phase}:${g.intro}`) sync();
        draw(g, ctx, now);
      }
      previous = now; frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    const visibility = () => { if (document.hidden && gameRef.current?.phase === 'ready') save(gameRef.current); };
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frameId); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  // The game loop owns its state and runs once per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') void navigator.serviceWorker.register('/sw.js').catch(() => {});
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as Event & { prompt: () => Promise<void> }); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(W, (e.clientX - box.left) * W / box.width)),
      y: Math.max(0, Math.min(box.height * W / box.width, (e.clientY - box.top) * W / box.width)) };
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current; if (!g || g.phase !== 'ready' || g.paused) return;
    e.currentTarget.setPointerCapture(e.pointerId); const p = point(e);
    g.aiming = true; g.aimX = p.x; g.aimY = p.y;
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => { const g = gameRef.current; if (!g?.aiming) return;
    const p = point(e); g.aimX = p.x; g.aimY = p.y; };
  const up = (e: PointerEvent<HTMLCanvasElement>) => { const g = gameRef.current; if (!g?.aiming) return;
    const p = point(e); g.aimX = p.x; g.aimY = p.y;
    undoRef.current = snapshot(g); setCanUndo(true);
    try { localStorage.setItem(UNDO_KEY, JSON.stringify(undoRef.current)); } catch {}
    if (!mutedRef.current) {
      try { audioRef.current ??= new AudioContext(); void audioRef.current.resume(); } catch {}
    }
    fire(g); sync(); };
  const undo = () => {
    const old = gameRef.current, last = undoRef.current;
    if (!old || !last) return;
    const restored = initial(old.h, old.best);
    restored.round = last.round; restored.count = last.count; restored.launchX = last.launchX;
    restored.bricks = last.bricks.map((b) => ({ ...b, pulse: 0 }));
    restored.pickups = last.pickups.map((p) => ({ ...p })); restored.id = last.id;
    restored.intro = false; restored.aimX = restored.launchX + 70;
    gameRef.current = restored; undoRef.current = null; setCanUndo(false);
    try { localStorage.removeItem(UNDO_KEY); } catch {}
    save(restored); sync();
  };
  const restart = () => { const g = gameRef.current; if (!g) return;
    const fresh = initial(g.h, g.best); fresh.intro = false; gameRef.current = fresh;
    undoRef.current = null; setCanUndo(false);
    try { localStorage.removeItem(UNDO_KEY); } catch {}
    save(fresh); sync(); setHelp(false); };
  const pause = () => { const g = gameRef.current; if (!g || g.phase === 'over') return;
    g.paused = !g.paused; g.aiming = false; sync(); };
  const speed = () => { const g = gameRef.current; if (g) { g.fast = !g.fast; sync(); } };
  const sound = () => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); };
  return <main className="game-screen"><section className="game-shell" aria-label="Little Bounce game">
    <header className="score-hud">
      <Button aria-label={hud.paused ? 'Resume game' : 'Pause game'} className="hud-icon pause-button" variant="ghost" size="icon-lg" onClick={pause} disabled={hud.phase === 'over'}>{hud.paused ? <Play /> : <Pause />}</Button>
      <span className="hud-label">ROUND</span><strong className="round-score">{hud.round}</strong>
      <span className="best-score">BEST {hud.best}</span>
      <Button aria-label="Undo last shot" className="undo-button" variant="ghost" size="sm" onClick={undo} disabled={!canUndo}><Undo2 /> Undo</Button>
    </header>
    <div className="game-board">
      <canvas ref={canvasRef} className="play-canvas" aria-label={`Round ${hud.round}, ${hud.count} balls. Drag to aim and release to launch.`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { if (gameRef.current) gameRef.current.aiming = false; }} />
      {hud.phase === 'firing' && <Button className="speed-button" variant="secondary" size="sm" onClick={speed}><FastForward /> {hud.fast ? 'Normal' : 'Speed up'}</Button>}
      {(hud.paused || hud.phase === 'over') && <div className="game-overlay" role="dialog" aria-modal="true" aria-label={hud.phase === 'over' ? 'Game over' : 'Paused'}>
        <div className="overlay-card"><span className="overlay-ornament">✦</span>
          <h2>{hud.phase === 'over' ? 'one more bounce?' : 'taking a breather?'}</h2>
          <p>{hud.phase === 'over' ? `You reached round ${hud.round}. Nice bouncing!` : 'Your little ball will wait right here.'}</p>
          <div className="overlay-actions">
            {hud.phase !== 'over' && <Button className="primary-action" onClick={pause}><Play /> Keep playing</Button>}
            <Button className={hud.phase === 'over' ? 'primary-action' : 'secondary-action'} variant={hud.phase === 'over' ? 'default' : 'outline'} onClick={restart}><RotateCcw /> Play again</Button>
          </div>
          <div className="menu-tools">
            <Button variant="ghost" size="sm" onClick={sound}>{muted ? <VolumeX /> : <Volume2 />} {muted ? 'Sound off' : 'Sound on'}</Button>
            <Button variant="ghost" size="sm" onClick={() => setHelp(true)}><HelpCircle /> How to play</Button>
          </div>
        </div>
      </div>}
    </div>
    <footer className="game-bottom"><h1>little bounce<span className="title-star">✳</span></h1>
      <p>{hud.phase === 'firing' ? 'Watch them bounce!' : hud.intro ? 'Drag to aim · Let go to bounce' : 'Find a clever angle and keep bouncing'}</p>
    </footer>
    {help && <div className="help-scrim" role="dialog" aria-modal="true" aria-label="How to play"><div className="help-card">
      <Button className="close-help" variant="ghost" size="icon" aria-label="Close help" onClick={() => setHelp(false)}><X /></Button>
      <span className="help-symbol">✳</span><h2>How to play</h2>
      <p>Drag on the board to aim, then let go. Each little ball bounces off the walls and soft blocks. A block disappears when its number reaches zero.</p>
      <p>Catch the green <strong>+1</strong> circles for more balls next turn. After every shot, the blocks move down one row. Keep them above the floor!</p>
      <div className="install-tip"><strong>Keep it on your iPhone</strong><span>In Safari, tap Share, then <b>Add to Home Screen</b>.</span>
        {installPrompt && <Button className="install-action" size="sm" onClick={() => { void installPrompt.prompt(); setInstallPrompt(null); }}>Install app</Button>}
      </div>
      <Button className="primary-action" onClick={() => setHelp(false)}>Got it</Button>
    </div></div>}
  </section></main>;
}
