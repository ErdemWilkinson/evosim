// Derleme: src/main.ts → tek bir IIFE paketi; sonra iki çıktı üretilir:
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

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;700&family=Onest:wght@400;500;600&display=swap">`;

function assemble(js) {
  const css = readFileSync(join(root, "src/styles.css"), "utf8");
  const body = readFileSync(join(root, "src/app.html"), "utf8");
  const script = js.replace(/<\/script/gi, "<\\/script");
  const fragment = `<title>Evosim</title>\n${FONTS}\n<style>\n${css}\n</style>\n${body}\n<script>\n${script}\n</script>\n`;
  writeFileSync(join(dist, "artifact.html"), fragment);
  writeFileSync(
    join(dist, "index.html"),
    `<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n${fragment}</body>\n</html>\n`
  );
}

// Simülasyon ayrı bir Web Worker'da çalışır. Tek dosyalık çıktı için Worker paketi
// önce derlenir ve ana pakete metin olarak gömülür (çalışma anında Blob'dan başlatılır).
const worker = await build({ entryPoints: [join(root, "src/worker.ts")], bundle: true, format: "iife", target: "es2020", minify: !serve, write: false, logLevel: "error" });

const ctx = await context({
  define: { __WORKER_SRC__: JSON.stringify(worker.outputFiles[0].text) },
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: !serve,
  write: false,
  logLevel: "info",
  plugins: [
    {
      name: "assemble",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0 || !result.outputFiles) return;
          assemble(result.outputFiles[0].text);
          console.log(`dist/index.html yazıldı (${Math.round(result.outputFiles[0].text.length / 1024)} KB betik)`);
        });
      },
    },
  ],
});

if (serve) {
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: dist, port: 5180 });
  console.log(`http://localhost:${port} — src/*.ts değişince yeniden derlenir (html, css ve simülasyon çekirdeği için betiği yeniden başlatın)`);
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
