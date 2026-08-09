import path from "path";
import fs from "fs/promises";

const DEBRID_MOUNT = process.env.DEBRID_MOUNT || "/mnt/zurg/__all__";
const PLEX_SYMLINK_ROOT = process.env.PLEX_SYMLINK_ROOT || "/mnt/plex_symlinks";
const JELLYFIN_LINK_ROOT = process.env.JELLYFIN_LINK_ROOT || "/mnt/jellyfin_links";

type RDFile = {
  id: number;
  path: string;
  bytes: number;
  selected: number;
};

interface SymlinkParams {
  infoData: { filename: string; files: RDFile[] };
  title: string;
  tmdbId: string | null;
  mediaType: "movie" | "tv";
  season: number | null;
  tmdbKey: string;
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
    console.warn(`[symlinks] ${DEBRID_MOUNT} not accessible — skipping`);
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  // Get year for folder name
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

  const folderName = year ? `${title} (${year})` : title;

  const videoFiles = infoData.files.filter(
    (f) => f.selected === 1 && /\.(mkv|mp4|avi)$/i.test(f.path),
  );

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No selected video files for "${title}"`);
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  for (const file of videoFiles) {
    // Normalize source path, including flat torrents wrapped by zurg
    const parts = file.path.replace(/^\//, "").split("/");
    const sourcePath =
      parts.length === 1
        ? path.join(DEBRID_MOUNT, infoData.filename, parts[0])
        : path.join(DEBRID_MOUNT, file.path);

    // ---------- Plex (symlinks) ----------
    const plexTargetDir = path.join(
      PLEX_SYMLINK_ROOT,
      mediaType === "movie" ? "Movies" : "TV_Shows",
      folderName,
      ...(mediaType === "tv"
        ? [`Season ${String(season ?? 1).padStart(2, "0")}`]
        : []),
    );
    await fs.mkdir(plexTargetDir, { recursive: true });

    const plexTargetPath = path.join(plexTargetDir, path.basename(file.path));
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

    // ---------- Jellyfin (hard links) ----------
    const jfTargetDir = path.join(
      JELLYFIN_LINK_ROOT,
      mediaType === "movie" ? "Movies" : "TV_Shows",
      folderName,
      ...(mediaType === "tv"
        ? [`Season ${String(season ?? 1).padStart(2, "0")}`]
        : []),
    );
    await fs.mkdir(jfTargetDir, { recursive: true });

    const jfTargetPath = path.join(jfTargetDir, path.basename(file.path));

    try {
      await fs.link(sourcePath, jfTargetPath); // HARD LINK
      console.log(`[jellyfin] ${jfTargetPath} => ${sourcePath}`);
      jellyfinPaths.push(jfTargetPath);
    } catch (e: any) {
      if (e.code === "EEXIST") {
        jellyfinPaths.push(jfTargetPath);
      } else if (e.code === "EXDEV") {
        // Cross-filesystem – fall back to symlink as last resort
        console.warn(
          `[jellyfin] EXDEV for ${jfTargetPath}, falling back to symlink`,
        );
        try {
          await fs.symlink(sourcePath, jfTargetPath);
          jellyfinPaths.push(jfTargetPath);
        } catch (se: any) {
          console.error(`[jellyfin] fallback symlink failed: ${se.message}`);
        }
      } else {
        console.error(`[jellyfin] hard link failed: ${e.message}`);
      }
    }
  }

  return { plex: plexPaths, jellyfin: jellyfinPaths };
}