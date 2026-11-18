"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Battleground atmosphere behind every page — all original artwork, no game assets:
 * transport plane + contrail, paratroopers, airdrop crate, landed red-smoke flare,
 * shrinking safe zone with "blue zone" tint, embers/dust/tracers on canvas, and a HUD
 * (compass strip, grid coordinates, alive counter). Pauses when the tab is hidden and
 * collapses to a static scene under prefers-reduced-motion.
 */
export function BattlegroundBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-75 md:opacity-100">
      <Zone />
      <EmberCanvas />
      <Plane />
      {JUMPERS.map((j, i) => (
        <Jumper key={i} {...j} />
      ))}
      <Airdrop />
      <SmokeFlare />
      <Hud />
    </div>
  );
}

/* ───────────── Safe zone ───────────── */
function Zone() {
  return (
    <>
      {/* blue zone: everything outside the safe circle gets a cold tint */}
      <div className="bg-zone absolute inset-0" />
      {/* safe-zone ring */}
      <div className="bg-zone-ring absolute top-[42%] left-[62%] aspect-square rounded-full border-2 border-white/40 shadow-[0_0_40px_rgba(46,245,198,0.35),inset_0_0_40px_rgba(46,245,198,0.15)]" />
      {/* next zone (dashed white) */}
      <div className="absolute top-[42%] left-[62%] aspect-square w-[34vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/25" />
    </>
  );
}

/* ───────────── Plane ───────────── */
function Plane() {
  return (
    <div className="bg-plane absolute top-[14%] left-0 flex items-center">
      <span className="bg-contrail h-[3px] w-[38vw] rounded-full bg-gradient-to-r from-transparent via-white/25 to-white/60" />
      <svg viewBox="0 0 120 60" className="h-10 w-20 opacity-70 sm:h-14 sm:w-28">
        {/* side-view transport plane silhouette (original drawing) */}
        <path d="M4 32 L20 30 L44 29 L48 18 L58 18 L62 29 L96 30 C108 31 116 33 116 36 C116 39 108 40 96 40 L30 41 L14 46 L8 46 L14 40 L4 38 Z" fill="#cfd3e6" opacity=".85" />
        <path d="M60 30 L74 8 L82 8 L76 30 Z" fill="#aeb3cb" opacity=".85" />
        <path d="M66 40 L74 56 L82 56 L78 40 Z" fill="#aeb3cb" opacity=".7" />
        <circle cx="104" cy="35" r="2" fill="#2ef5c6" />
        <circle cx="108" cy="35" r="1" fill="#ff2fb9" className="animate-pulse" />
      </svg>
    </div>
  );
}

/* ───────────── Paratroopers ───────────── */
const JUMPERS = [
  { left: "18%", delay: "-2s", dur: "22s", size: 1, hue: "#4a5068" },
  { left: "34%", delay: "-9s", dur: "26s", size: 0.75, hue: "#3d4256" },
  { left: "52%", delay: "-15s", dur: "24s", size: 0.9, hue: "#565b72" },
  { left: "71%", delay: "-5s", dur: "28s", size: 0.65, hue: "#3a3e52" },
  { left: "86%", delay: "-19s", dur: "25s", size: 0.85, hue: "#4a5068" },
];

function Jumper({ left, delay, dur, size, hue }: { left: string; delay: string; dur: string; size: number; hue: string }) {
  return (
    <div className="bg-jumper absolute -top-24" style={{ left, animationDelay: delay, animationDuration: dur }}>
      <div className="bg-sway" style={{ animationDelay: delay }}>
        <svg viewBox="0 0 60 80" className="h-16 w-12 opacity-45 sm:h-20 sm:w-16" style={{ transform: `scale(${size})` }}>
          <path d="M4 26 C4 10 18 2 30 2 C42 2 56 10 56 26 C50 22 44 22 38 26 C34 22 26 22 22 26 C16 22 10 22 4 26 Z" fill={hue} fillOpacity=".85" stroke="#9aa0b8" strokeOpacity=".35" />
          <path d="M5 26 L28 58 M22 26 L29 58 M38 26 L31 58 M55 26 L32 58" stroke="#fff" strokeOpacity=".45" strokeWidth="0.8" />
          {/* jumper */}
          <circle cx="30" cy="60" r="3.2" fill="#e5e7f5" />
          <path d="M26 64 L34 64 L33 72 L31 72 L30 78 L29 72 L27 72 Z" fill="#c9cde0" />
        </svg>
      </div>
    </div>
  );
}

/* ───────────── Airdrop crate ───────────── */
function Airdrop() {
  return (
    <div className="bg-airdrop absolute -top-40 left-[8%] sm:left-[44%]">
      <div className="bg-sway [animation-duration:5s]">
        <svg viewBox="0 0 90 130" className="h-28 w-20 opacity-55 sm:h-36 sm:w-24">
          <path d="M6 36 C6 14 26 4 45 4 C64 4 84 14 84 36 C76 30 66 30 58 36 C52 30 38 30 32 36 C24 30 14 30 6 36 Z" fill="#5a2333" fillOpacity=".85" stroke="#9aa0b8" strokeOpacity=".3" />
          <path d="M7 36 L30 92 M32 36 L38 92 M58 36 L52 92 M83 36 L60 92" stroke="#fff" strokeOpacity=".45" strokeWidth="1" />
          {/* crate */}
          <rect x="26" y="90" width="38" height="32" rx="3" fill="#6b4a1f" stroke="#a37a3a" strokeWidth="1.5" />
          <path d="M26 100 H64 M26 112 H64 M45 90 V122" stroke="#78350f" strokeWidth="2" />
          <rect x="38" y="102" width="14" height="8" rx="1.5" fill="#c9952f" />
        </svg>
      </div>
    </div>
  );
}

/* ───────────── Landed airdrop: red smoke flare ───────────── */
function SmokeFlare() {
  const puffs = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div className="absolute right-[6%] bottom-[6%] h-[55vh] w-40 sm:right-[10%]">
      {puffs.map((i) => (
        <span
          key={i}
          className="bg-smoke absolute bottom-0 left-1/2 size-16 rounded-full bg-[radial-gradient(circle,rgba(255,70,90,0.45),rgba(255,47,185,0.12)_55%,transparent_70%)]"
          style={{ animationDelay: `${-i * 1.1}s`, marginLeft: `${(i % 3) * 10 - 40}px` }}
        />
      ))}
      <span className="absolute bottom-0 left-1/2 size-3 -translate-x-1/2 animate-pulse rounded-full bg-[#ff4b6e] shadow-[0_0_24px_8px_rgba(255,75,110,0.6)]" />
    </div>
  );
}

/* ───────────── HUD ───────────── */
const COMPASS = ["N", "15", "30", "NE", "60", "75", "E", "105", "120", "SE", "150", "165", "S", "195", "210", "SW", "240", "255", "W", "285", "300", "NW", "330", "345"];

function Hud() {
  const [alive, setAlive] = useState(99);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAlive((a) => (a <= 12 ? 99 : a - Math.ceil(Math.random() * 3))), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {/* compass strip */}
      <div className="absolute top-[72px] left-1/2 w-[min(640px,80vw)] -translate-x-1/2 overflow-hidden opacity-40 [mask-image:linear-gradient(90deg,transparent,black_25%,black_75%,transparent)]">
        <div className="bg-compass flex w-max gap-6 font-display text-[10px] tracking-widest text-white/80">
          {[...COMPASS, ...COMPASS].map((c, i) => (
            <span key={i} className={c.length < 3 && isNaN(Number(c)) ? "text-mint" : ""}>
              {c}
            </span>
          ))}
        </div>
        <div className="mx-auto mt-1 h-2 w-px bg-neon" />
      </div>
      {/* map grid coordinates */}
      <div className="absolute inset-x-0 top-[96px] hidden justify-around font-display text-[10px] tracking-widest text-white/15 md:flex">
        {"ABCDEFGH".split("").map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="absolute inset-y-24 left-2 hidden flex-col justify-around font-display text-[10px] text-white/15 md:flex">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      {/* alive counter */}
      <div className="absolute top-[110px] right-4 hidden items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-1 font-display text-[10px] tracking-widest text-white/60 backdrop-blur-sm sm:flex">
        <span className="size-1.5 animate-pulse rounded-full bg-neon" /> ALIVE <span className="text-white">{alive}</span>
        <span className="text-white/30">|</span> ZONE <span className="text-mint">SHRINKING</span>
      </div>
    </>
  );
}

/* ───────────── Canvas: embers, dust, tracers ───────────── */
type Ember = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hue: number };
type Tracer = { x: number; y: number; vx: number; vy: number; life: number };

function EmberCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Phones render the particle layer at 1x to stay within GPU memory budgets.
    const dpr = window.innerWidth < 768 ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const count = w < 640 ? 34 : 70;
    const spawn = (initial = false): Ember => {
      const max = 300 + Math.random() * 400;
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.25 + Math.random() * 0.7),
        r: Math.random() < 0.15 ? 1.6 + Math.random() * 1.6 : 0.6 + Math.random() * 1.1,
        life: initial ? Math.random() * max : 0,
        max,
        hue: Math.random() < 0.7 ? 25 + Math.random() * 20 : Math.random() < 0.5 ? 165 : 320, // ember orange, some mint/magenta sparks
      };
    };
    const embers = Array.from({ length: count }, () => spawn(true));
    const tracers: Tracer[] = [];
    let raf = 0;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // tracers: occasional fast streaks from the edges
      if (!reduced && Math.random() < 0.012) {
        const fromLeft = Math.random() < 0.5;
        const y = h * (0.25 + Math.random() * 0.6);
        const speed = 22 + Math.random() * 14;
        tracers.push({ x: fromLeft ? -40 : w + 40, y, vx: fromLeft ? speed : -speed, vy: (Math.random() - 0.5) * 4, life: 0 });
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        tr.x += tr.vx;
        tr.y += tr.vy;
        tr.life++;
        const tail = 90;
        const g = ctx.createLinearGradient(tr.x, tr.y, tr.x - Math.sign(tr.vx) * tail, tr.y - tr.vy * (tail / Math.abs(tr.vx)));
        g.addColorStop(0, "rgba(255,236,170,0.95)");
        g.addColorStop(1, "rgba(255,160,60,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y);
        ctx.lineTo(tr.x - Math.sign(tr.vx) * tail, tr.y - tr.vy * (tail / Math.abs(tr.vx)));
        ctx.stroke();
        if (tr.x < -200 || tr.x > w + 200) tracers.splice(i, 1);
      }
      // embers
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.life++;
        e.x += e.vx + Math.sin((e.life + i * 40) / 60) * 0.25;
        e.y += e.vy;
        const p = e.life / e.max;
        const alpha = Math.sin(Math.PI * Math.min(p, 1)) * (0.55 + 0.45 * Math.sin((t + i * 13) / 9));
        if (p >= 1 || e.y < -10) {
          embers[i] = spawn();
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${e.hue}, 100%, 62%, ${Math.max(alpha, 0) * 0.85})`;
        ctx.shadowColor = `hsla(${e.hue}, 100%, 60%, 0.9)`;
        ctx.shadowBlur = e.r * 6;
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      t++;
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };
    if (reduced) draw();
    else raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
}
