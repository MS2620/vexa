import path from "path";
import fs from "fs/promises";
import type { DebridFile } from "./debrid/client";

const DEBRID_MOUNT = process.env.DEBRID_MOUNT || "/mnt/zurg/__all__";
const PLEX_SYMLINK_ROOT = process.env.PLEX_SYMLINK_ROOT || "/mnt/plex_symlinks";
const JELLYFIN_LINK_ROOT = process.env.JELLYFIN_LINK_ROOT || "/mnt/jellyfin_links";

interface SymlinkParams {
  infoData: { filename: string; files: DebridFile[] };
  title: string;
  tmdbId: string | null;
  mediaType: "movie" | "tv";
  season: number | null;
  episode?: number | null; // NEW
  tmdbKey: string;
}

function classifyResolution(p: string): string {
  const s = p.toLowerCase();
  if (s.includes("2160p") || s.includes("4k") || s.includes("uhd")) return "4K";
  if (s.includes("1080p")) return "1080p";
  if (s.includes("720p")) return "720p";
  return "SD";
}

function buildVersionLabel(filePath: string): string {
  return classifyResolution(filePath);
}

function episodeTag(season: number | null, episode: number | null | undefined): string {
  const s = String(season ?? 1).padStart(2, "0");
  const e = String(episode ?? 1).padStart(2, "0");
  return `S${s}E${e}`;
}

export async function createSymlinks({
  infoData,
  title,
  tmdbId,
  mediaType,
  season,
  episode,
  tmdbKey,
}: SymlinkParams): Promise<{ plex: string[]; jellyfin: string[] }> {
  const plexPaths: string[] = [];
  const jellyfinPaths: string[] = [];

  try {
    await fs.access(DEBRID_MOUNT);
  } catch {
    console.warn(
      `[symlinks] ${DEBRID_MOUNT} not accessible — skipping symlink creation`,
    );
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  let year = "";
  if (tmdbId && tmdbKey) {
    try {
      const endpoint =
        mediaType === "movie"
          ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`
          : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const dateStr =
        mediaType === "movie" ? data.release_date : data.first_air_date;
      if (dateStr) year = (dateStr as string).slice(0, 4);
    } catch {
      // ignore, continue without year
    }
  }

  const baseName = year ? `${title} (${year})` : title;
  const epTag = mediaType === "tv" ? episodeTag(season, episode) : "";

  const videoFiles = infoData.files.filter((f) =>
    /\.(mkv|mp4|avi)$/i.test(f.path),
  );

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No video files found for "${title}"`);
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  for (const file of videoFiles) {
    const parts = file.path.replace(/^\//, "").split("/");
    const sourcePath =
      parts.length === 1
        ? path.join(DEBRID_MOUNT, infoData.filename, parts[0])
        : path.join(DEBRID_MOUNT, file.path);

    const ext = path.extname(file.path) || ".mkv";
    const versionLabel = buildVersionLabel(file.path);

    // ---------- Plex ----------
    {
      const plexTargetDir = path.join(
        PLEX_SYMLINK_ROOT,
        mediaType === "movie" ? "Movies" : "TV_Shows",
        baseName,
        ...(mediaType === "tv"
          ? [`Season ${String(season ?? 1).padStart(2, "0")}`]
          : []),
      );
      await fs.mkdir(plexTargetDir, { recursive: true });

      // For TV: include SxxExx so Plex can match the episode correctly
      const plexFileName =
        mediaType === "tv"
          ? `${baseName} - ${epTag}${ext}`
          : path.basename(file.path);

      const plexTargetPath = path.join(plexTargetDir, plexFileName);

      try {
        await fs.symlink(sourcePath, plexTargetPath);
        console.log(`[plex] ${plexTargetPath} → ${sourcePath}`);
        plexPaths.push(plexTargetPath);
      } catch (e: any) {
        if (e.code === "EEXIST") {
          plexPaths.push(plexTargetPath);
        } else {
          console.error(`[plex] symlink failed: ${e.message}`);
        }
      }
    }

    // ---------- Jellyfin ----------
    if (JELLYFIN_LINK_ROOT) {
      const jfTargetDir = path.join(
        JELLYFIN_LINK_ROOT,
        mediaType === "movie" ? "Movies" : "TV_Shows",
        baseName,
        ...(mediaType === "tv"
          ? [`Season ${String(season ?? 1).padStart(2, "0")}`]
          : []),
      );
      await fs.mkdir(jfTargetDir, { recursive: true });

      let jfFileName: string;
      if (mediaType === "tv") {
        // e.g. "Lioness (2023) - S01E01 - 4K.mkv"
        jfFileName =
          versionLabel && versionLabel !== "SD"
            ? `${baseName} - ${epTag} - ${versionLabel}${ext}`
            : `${baseName} - ${epTag}${ext}`;
      } else {
        jfFileName =
          versionLabel && versionLabel !== "SD"
            ? `${baseName} - ${versionLabel}${ext}`
            : `${baseName}${ext}`;
      }

      const jfTargetPath = path.join(jfTargetDir, jfFileName);

      try {
        await fs.symlink(sourcePath, jfTargetPath);
        console.log(`[jellyfin] ${jfTargetPath} → ${sourcePath}`);
        jellyfinPaths.push(jfTargetPath);
      } catch (e: any) {
        if (e.code === "EEXIST") {
          jellyfinPaths.push(jfTargetPath);
        } else {
          console.error(`[jellyfin] symlink failed: ${e.message}`);
        }
      }
    }
  }

  return { plex: plexPaths, jellyfin: jellyfinPaths };
}