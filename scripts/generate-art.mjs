// Generates original, stylised SVG artwork for demo/seed listings into public/art.
// These are placeholders — real listings use seller-uploaded images.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = path.join(process.cwd(), "public", "art");
mkdirSync(out, { recursive: true });

const SUBJECTS = {
  rifle: `
    <g transform="translate(90 205) scale(1.55)">
      <path d="M8 70 L70 58 L92 52 L120 50 L128 40 L250 38 L262 30 L300 30 L304 38 L380 38 L384 34 L404 34 L404 46 L384 46 L382 52 L300 54 L292 62 L250 64 L246 70 L214 72 L206 118 L186 122 L180 76 L150 78 L140 104 L118 106 L124 78 L96 82 L70 96 L18 108 L4 100 Z"/>
      <rect x="150" y="16" width="88" height="16" rx="6"/>
      <rect x="168" y="8" width="40" height="10" rx="4"/>
      <path d="M300 54 L340 54 L340 62 L300 62 Z"/>
    </g>`,
  smg: `
    <g transform="translate(150 200) scale(1.6)">
      <path d="M10 60 L60 50 L80 44 L110 44 L118 34 L240 34 L248 28 L290 28 L290 44 L248 46 L240 54 L180 56 L176 110 L156 112 L152 58 L128 60 L120 88 L100 90 L104 62 L70 70 L16 84 Z"/>
      <rect x="140" y="16" width="70" height="14" rx="5"/>
    </g>`,
  figure: `
    <g transform="translate(250 60)">
      <path d="M150 20 C110 20 92 52 94 86 C96 104 104 116 110 122 L100 134 C70 140 40 160 30 196 L10 300 L40 306 L58 230 L66 300 L60 470 L118 470 L140 330 L160 330 L182 470 L240 470 L234 300 L242 230 L260 306 L290 300 L270 196 C260 160 230 140 200 134 L190 122 C196 116 204 104 206 86 C208 52 190 20 150 20 Z"/>
      <path d="M96 140 L60 120 L40 150 L70 170 Z M204 140 L240 120 L260 150 L230 170 Z" opacity=".85"/>
      <path d="M112 74 L188 74 L182 96 L118 96 Z" fill="url(#visor)"/>
    </g>`,
  car: `
    <g transform="translate(70 230) scale(1.65)">
      <path d="M10 110 L18 82 C24 72 40 66 70 62 L130 34 C150 26 200 24 240 30 L300 56 L360 64 C380 68 392 80 396 96 L398 112 L360 114 C356 90 316 86 304 114 L120 116 C114 88 74 86 66 114 Z"/>
      <path d="M140 40 L190 36 L196 60 L120 62 Z M206 36 C232 36 254 40 276 56 L210 60 Z" fill="url(#visor)"/>
      <circle cx="93" cy="114" r="24"/><circle cx="332" cy="114" r="24"/>
    </g>`,
  buggy: `
    <g transform="translate(110 210) scale(1.55)">
      <path d="M20 120 L40 90 L110 84 L150 40 L250 40 L290 84 L360 90 L370 120 L330 122 C326 92 286 92 282 122 L120 122 C116 92 76 92 72 122 Z"/>
      <path d="M150 40 L170 10 L230 10 L250 40" fill="none" stroke-width="8"/>
      <circle cx="96" cy="124" r="28"/><circle cx="306" cy="124" r="28"/>
    </g>`,
  helmet: `
    <g transform="translate(220 90)">
      <path d="M180 20 C80 20 20 100 20 200 L20 270 C20 300 60 330 110 340 L130 300 L230 300 L250 340 C300 330 340 300 340 270 L340 200 C340 100 280 20 180 20 Z"/>
      <path d="M60 170 L300 170 L290 250 L70 250 Z" fill="url(#visor)"/>
      <path d="M150 30 L210 30 L200 120 L160 120 Z" opacity=".7"/>
    </g>`,
  backpack: `
    <g transform="translate(260 70)">
      <path d="M90 60 C90 20 190 20 190 60 L240 80 C270 90 280 120 280 150 L280 420 C280 450 260 470 230 470 L50 470 C20 470 0 450 0 420 L0 150 C0 120 10 90 40 80 Z"/>
      <rect x="50" y="230" width="180" height="120" rx="18" fill="url(#visor)"/>
      <rect x="70" y="140" width="140" height="50" rx="12" opacity=".7"/>
    </g>`,
  parachute: `
    <g transform="translate(180 50)">
      <path d="M220 20 C90 20 10 110 0 210 C40 190 80 190 110 210 C140 190 180 190 220 210 C260 190 300 190 330 210 C360 190 400 190 440 210 C430 110 350 20 220 20 Z"/>
      <path d="M2 212 L200 420 M110 210 L205 420 M220 210 L220 420 M330 210 L235 420 M438 212 L240 420" fill="none" stroke-width="4"/>
      <rect x="180" y="410" width="80" height="70" rx="10"/>
    </g>`,
  coin: `
    <g transform="translate(250 90)">
      <polygon points="150,0 290,80 290,240 150,320 10,240 10,80"/>
      <polygon points="150,34 260,98 260,222 150,286 40,222 40,98" fill="url(#visor)"/>
      <text x="150" y="196" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="96" font-weight="900" fill="#1a0b00">UC</text>
    </g>`,
};

function svg({ subject, hue, accent = hue + 40, w = 800, h = 600, label }) {
  const c1 = `hsl(${hue} 95% 62%)`;
  const c2 = `hsl(${accent} 90% 45%)`;
  const glow = `hsl(${hue} 100% 55%)`;
  let dots = "";
  for (let i = 0; i < 28; i++) {
    const x = (i * 137.5 + hue * 3) % w;
    const y = (i * 89.3 + hue) % (h * 0.8);
    dots += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + (i % 3)).toFixed(0)}" fill="${glow}" opacity="${(0.15 + (i % 5) * 0.08).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="hsl(${hue} 70% 18%)"/>
      <stop offset=".55" stop-color="#120708"/>
      <stop offset="1" stop-color="#070707"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset=".5" stop-color="${c2}"/>
      <stop offset="1" stop-color="hsl(${hue} 80% 22%)"/>
    </linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/>
      <stop offset="1" stop-color="${c1}" stop-opacity=".7"/>
    </linearGradient>
    <radialGradient id="pad" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${glow}" stop-opacity=".7"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${dots}
  <ellipse cx="${w / 2}" cy="${h - 70}" rx="${w * 0.36}" ry="34" fill="url(#pad)"/>
  <ellipse cx="${w / 2}" cy="${h - 70}" rx="${w * 0.3}" ry="20" fill="none" stroke="#ff2fb9" stroke-width="3" opacity=".8"/>
  <g filter="url(#glow)" fill="url(#body)" stroke="${c1}" stroke-width="2" stroke-linejoin="round">${SUBJECTS[subject]}</g>
</svg>`;
}

const sets = [
  ["rifle", [200, 190, 275, 0, 45, 160]],
  ["smg", [130, 300, 20]],
  ["figure", [210, 0, 280, 45, 320, 170, 25]],
  ["car", [285, 45, 0, 195]],
  ["buggy", [20, 140]],
  ["helmet", [0, 200, 45, 270]],
  ["backpack", [30, 190, 300]],
  ["parachute", [350, 200]],
  ["coin", [40]],
];

let n = 0;
for (const [subject, hues] of sets) {
  hues.forEach((hue, i) => {
    writeFileSync(path.join(out, `${subject}-${i + 1}.svg`), svg({ subject, hue, label: `${subject} artwork` }));
    n++;
  });
}

// Wide promo banners.
const banner = (subject, hue, name) =>
  writeFileSync(path.join(out, name), svg({ subject, hue, w: 1200, h: 600, label: "promotional artwork" }).replace(/translate\((\d+) /, (_, x) => `translate(${Number(x) + 520} `));
banner("figure", 210, "banner-1.svg");
banner("rifle", 0, "banner-2.svg");
banner("car", 285, "banner-3.svg");
console.log(`generated ${n + 3} svg files in public/art`);

// 24-frame turntable for the 360° viewer demo (rotation simulated by horizontal scaling).
mkdirSync(path.join(out, "spin"), { recursive: true });
for (let k = 0; k < 24; k++) {
  const a = (k / 24) * Math.PI * 2;
  let sx = Math.cos(a);
  if (Math.abs(sx) < 0.12) sx = sx < 0 ? -0.12 : 0.12;
  const sy = 1 - Math.abs(Math.sin(a)) * 0.08;
  const base = svg({ subject: "rifle", hue: 200, label: "rifle 360 frame" });
  const framed = base.replace('<g filter="url(#glow)"', `<g transform="translate(400 300) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-400 -300)"><g filter="url(#glow)"`).replace(/<\/g>\n<\/svg>$/, "</g></g>\n</svg>");
  writeFileSync(path.join(out, "spin", `rifle-${String(k).padStart(2, "0")}.svg`), framed);
}
console.log("generated 24 spin frames");
