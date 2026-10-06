// Derleme: src/main.ts → IIFE paketi; iki çıktı üretilir:
//   dist/index.html    — çift tıklayınca açılan, her şeyi içinde taşıyan tam sayfa
//   dist/artifact.html — aynı içerik, <html>/<head>/<body> sarmalı olmadan (yayın için)
// `--serve` ile değişiklikleri izler ve http://localhost:5180 üzerinden sunar.
import { build, context } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const serve = process.argv.includes("--serve");
mkdirSync(dist, { recursive: true });

const BANNER = "/* Evosim (c) 2026 ErdemWilkinson. All rights reserved. Copying, re-uploading or redistributing this game or its code without written permission is prohibited. */";
const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;700&family=Onest:wght@400;500;600&display=swap">`;

function fragment(js) {
  const css = readFileSync(join(root, "src/styles.css"), "utf8");
  const body = readFileSync(join(root, "src/app.html"), "utf8");
  const script = js.replace(/<\/script/gi, "<\/script");
  return `<title>Evosim</title>
${FONTS}
<style>
${css}
</style>
${body}
<script>
${script}
</script>
`;
}

/** Tam sayfa: herkese açık sürüm. */
function writePage(js) {
  writeFileSync(
    join(dist, "index.html"),
    `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="copyright" content="(c) 2026 ErdemWilkinson. All rights reserved.">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${fragment(js)}</body>
</html>
`
  );
}

// Simülasyon ayrı bir Web Worker'da çalışır. Tek dosyalık çıktı için Worker paketi
// önce derlenir ve ana pakete metin olarak gömülür (çalışma anında Blob'dan başlatılır).
const worker = await build({ entryPoints: [join(root, "src/worker.ts")], bundle: true, format: "iife", target: "es2020", minify: !serve, write: false, logLevel: "error" });

const options = (artifact) => ({
  define: { __WORKER_SRC__: JSON.stringify(worker.outputFiles[0].text), __ARTIFACT__: String(artifact) },
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: !serve,
  legalComments: "none",
  banner: { js: BANNER },
  write: false,
});

if (serve) {
  const ctx = await context({
    ...options(false),
    logLevel: "info",
    plugins: [
      {
        name: "assemble",
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length > 0 || !result.outputFiles) return;
            writePage(result.outputFiles[0].text);
            console.log("dist/index.html yazıldı");
          });
        },
      },
    ],
  });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: dist, port: 5180 });
  console.log(`http://localhost:${port} — src/*.ts değişince yeniden derlenir (html, css ve simülasyon çekirdeği için betiği yeniden başlatın)`);
} else {
  // İki ayrı paket: yayın parçası (artifact) çalışma zamanı özelliklerini taşır, tam sayfa taşımaz.
  const page = await build({ ...options(false), logLevel: "error" });
  writePage(page.outputFiles[0].text);
  const artifact = await build({ ...options(true), logLevel: "error" });
  writeFileSync(join(dist, "artifact.html"), fragment(artifact.outputFiles[0].text));
  console.log(`dist/index.html yazıldı (${Math.round(page.outputFiles[0].text.length / 1024)} KB betik)`);
}
