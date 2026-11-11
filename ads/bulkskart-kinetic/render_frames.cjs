// Renders the kinetic ad frame-by-frame at 1080x1920, 30 fps, 15 s.
// Usage:
//   node render_frames.cjs <outDir>                 # full 450 frames -> f0000.png ...
//   node render_frames.cjs <outDir> 1.0,3.0,11.5    # only the listed times -> t_<time>.png
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const outDir = process.argv[2];
const timesArg = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.waitForFunction(() => window.ready === true);

  const FPS = 30, DUR = 15;
  if (timesArg) {
    for (const t of timesArg.split(',').map(Number)) {
      await page.evaluate(x => window.render(x), t);
      await page.screenshot({ path: path.join(outDir, `t_${t.toFixed(2)}.png`) });
    }
  } else {
    const N = FPS * DUR;
    for (let i = 0; i < N; i++) {
      await page.evaluate(x => window.render(x), i / FPS);
      await page.screenshot({ path: path.join(outDir, `f${String(i).padStart(4, '0')}.png`) });
      if (i % 50 === 0) console.log('frame', i);
    }
    console.log('done', N, 'frames');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
