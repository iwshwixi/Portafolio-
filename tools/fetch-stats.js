#!/usr/bin/env node
/**
 * fetch-stats.js — Actualiza youtube-stats.json usando la YouTube Data API v3
 *
 * USO:
 *   node tools/fetch-stats.js TU_API_KEY
 *
 * OBTENER API KEY (gratis):
 *   1. Ve a https://console.cloud.google.com/
 *   2. Crea un proyecto nuevo
 *   3. Activa "YouTube Data API v3"
 *   4. Crea credenciales → Clave de API
 *   5. Copia la clave y usala aqui
 *
 * AUTOMATIZAR con GitHub Actions:
 *   Guarda la key como secreto YOUTUBE_API_KEY en tu repo
 *   y el workflow .github/workflows/update-stats.yml lo corre cada 12h
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const API_KEY = process.argv[2] || process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error("❌ Falta API key. Uso: node tools/fetch-stats.js TU_API_KEY");
  console.error("   O define la variable de entorno: YOUTUBE_API_KEY=... node tools/fetch-stats.js");
  process.exit(1);
}

// Lee los videos del portafolio
const videos = JSON.parse(readFileSync(join(ROOT, "data/videos.json"), "utf8"));
const videoIds = videos.map((v) => v.videoId).filter(Boolean);

if (!videoIds.length) {
  console.error("❌ No hay videoIds en data/videos.json");
  process.exit(1);
}

console.log(`🎬 Consultando stats para ${videoIds.length} videos...`);

// YouTube Data API v3 — videos.list (statistics + contentDetails)
const url = new URL("https://www.googleapis.com/youtube/v3/videos");
url.searchParams.set("key", API_KEY);
url.searchParams.set("id", videoIds.join(","));
url.searchParams.set("part", "statistics,contentDetails,snippet");
url.searchParams.set("maxResults", "50");

let data;
try {
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  data = await res.json();
} catch (err) {
  console.error("❌ Error al llamar la API:", err.message);
  process.exit(1);
}

const result = { updatedAt: new Date().toISOString(), videos: {} };

for (const item of data.items || []) {
  const stats = item.statistics || {};
  const details = item.contentDetails || {};
  const snippet = item.snippet || {};

  // Parsea duración ISO 8601 → "mm:ss" o "h:mm:ss"
  const iso = details.duration || "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(match?.[1] || "0");
  const m = parseInt(match?.[2] || "0");
  const s = parseInt(match?.[3] || "0");
  const duration = h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;

  result.videos[item.id] = {
    views: parseInt(stats.viewCount || "0"),
    likes: parseInt(stats.likeCount || "0"),
    comments: parseInt(stats.commentCount || "0"),
    duration,
    publishedAt: snippet.publishedAt?.split("T")[0] || "",
    title: snippet.title || "",
    channelTitle: snippet.channelTitle || ""
  };

  const views = parseInt(stats.viewCount || "0").toLocaleString("es-MX");
  const likes = parseInt(stats.likeCount || "0").toLocaleString("es-MX");
  console.log(`  ✅ ${item.id} — ${snippet.title}`);
  console.log(`     👁  ${views} vistas  |  👍 ${likes} likes  |  ⏱ ${duration}`);
}

// Guarda el resultado
const outputPath = join(ROOT, "data/youtube-stats.json");
writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
console.log(`\n✅ Guardado en data/youtube-stats.json`);
console.log(`   ${Object.keys(result.videos).length} videos actualizados — ${result.updatedAt}`);
