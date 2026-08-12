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
  tmdbKey: string;
}

// crude resolution classifier from a filename
function classifyResolution(p: string): string {
  const s = p.toLowerCase();
  if (s.includes("2160p") || s.includes("4k") || s.includes("uhd")) return "4K";
  if (s.includes("1080p")) return "1080p";
  if (s.includes("720p")) return "720p";
  return "SD";
}

// sanity-clean label (optional)
function buildVersionLabel(filePath: string): string {
  const res = classifyResolution(filePath);
  // you can add more info here later (HDR, DV, etc)
  return res;
}

export async function createSymlinks({
  infoData,
  title,
  tmdbId,
  mediaType,
  season,
  tmdbKey,
}: SymlinkParams): Promise<{ plex: string[]; jellyfin: string[] }> {
  const plexPaths: string[] = [];
  const jellyfinPaths: string[] = [];

  // Skip if zurg mount not available
  try {
    await fs.access(DEBRID_MOUNT);
  } catch {
    console.warn(
      `[symlinks] ${DEBRID_MOUNT} not accessible — skipping symlink creation`,
    );
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  // Fetch year from TMDB
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

  // Video files only (selection already handled upstream via client.selectFiles)
  const videoFiles = infoData.files.filter((f) =>
    /\.(mkv|mp4|avi)$/i.test(f.path),
  );

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No video files found for "${title}"`);
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  for (const file of videoFiles) {
    // Build source path (handles flat vs folder torrents)
    const parts = file.path.replace(/^\//, "").split("/");
    const sourcePath =
      parts.length === 1
        ? path.join(DEBRID_MOUNT, infoData.filename, parts[0])
        : path.join(DEBRID_MOUNT, file.path);

    const ext = path.extname(file.path) || ".mkv";
    const versionLabel = buildVersionLabel(file.path);

    // ---------- Plex: keep scene-friendly names ----------
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

      const plexTargetPath = path.join(
        plexTargetDir,
        path.basename(file.path),
      );

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

    // ---------- Jellyfin: TMDB-based names + version suffix ----------
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

      // Jellyfin grouping rule: file base name must exactly match folder, suffix after " - "
      const jfFileName =
        versionLabel && versionLabel !== "SD"
          ? `${baseName} - ${versionLabel}${ext}`
          : `${baseName}${ext}`;

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