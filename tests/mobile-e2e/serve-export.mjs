// Tiny static server with single-page fallback for the Expo web export (app.json web.output = "single").
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.env.EXPORT_DIR;
const port = Number(process.env.PORT ?? 8081);
if (!root) throw new Error("Set EXPORT_DIR to the expo export output directory");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2" };

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(root, "index.html"); // SPA fallback
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`serving ${root} on ${port}`));
