import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videosPath = path.join(root, "data", "videos.json");
const statsPath = path.join(root, "data", "youtube-stats.json");
const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  throw new Error("Falta YOUTUBE_API_KEY. Agrega el secreto en GitHub Actions.");
}

const videos = JSON.parse(await readFile(videosPath, "utf8"));
const videoIds = [...new Set(videos.map((video) => video.videoId).filter(Boolean))];

if (!videoIds.length) {
  await writeFile(statsPath, JSON.stringify({ updatedAt: new Date().toISOString(), videos: {} }, null, 2));
  process.exit(0);
}

const result = { updatedAt: new Date().toISOString(), videos: {} };

for (let index = 0; index < videoIds.length; index += 50) {
  const batch = videoIds.slice(index, index + 50);
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: batch.join(","),
    key: apiKey
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!response.ok) {
    throw new Error(`YouTube API respondio ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  for (const item of payload.items ?? []) {
    result.videos[item.id] = {
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      views: Number(item.statistics?.viewCount ?? 0),
      likes: Number(item.statistics?.likeCount ?? 0),
      comments: Number(item.statistics?.commentCount ?? 0),
      duration: item.contentDetails?.duration ?? ""
    };
  }
}

await writeFile(statsPath, `${JSON.stringify(result, null, 2)}\n`);
