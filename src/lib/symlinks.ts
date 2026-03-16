import path from "path";
import fs from "fs/promises";

const DEBRID_MOUNT = process.env.DEBRID_MOUNT || "/mnt/zurg/__all__";
const PLEX_SYMLINK_ROOT = process.env.PLEX_SYMLINK_ROOT || "/mnt/plex_symlinks";

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
}: SymlinkParams): Promise<void> {
  // Skip silently if the zurg mount isn't available (dev or unconfigured)
  try {
    await fs.access(DEBRID_MOUNT);
  } catch {
    console.warn(
      `[symlinks] ${DEBRID_MOUNT} not accessible — skipping symlink creation`,
    );
    return;
  }

  // Fetch release year from TMDB to build the Plex folder name
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
      // Year lookup failed — proceed without it
    }
  }

  const folderName = year ? `${title} (${year})` : title;

  // Only symlink selected video files (same filter as file selection)
  const videoFiles = infoData.files.filter(
    (f) => f.selected === 1 && /\.(mkv|mp4|avi)$/i.test(f.path),
  );

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No selected video files found for "${title}"`);
    return;
  }

  for (const file of videoFiles) {
    // RD file.path is like "/TorrentName/video.mkv"
    // zurg __all__ maps to: DEBRID_MOUNT + file.path
    const sourcePath = path.join(DEBRID_MOUNT, file.path);

    let targetDir: string;
    if (mediaType === "movie") {
      targetDir = path.join(PLEX_SYMLINK_ROOT, "Movies", folderName);
    } else {
      const seasonStr = season
        ? `Season ${String(season).padStart(2, "0")}`
        : "Season 01";
      targetDir = path.join(
        PLEX_SYMLINK_ROOT,
        "TV Shows",
        folderName,
        seasonStr,
      );
    }

    await fs.mkdir(targetDir, { recursive: true });

    const targetPath = path.join(targetDir, path.basename(file.path));
    try {
      await fs.symlink(sourcePath, targetPath);
      console.log(`[symlinks] ${targetPath} → ${sourcePath}`);
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        (e as NodeJS.ErrnoException).code !== "EEXIST"
      ) {
        console.error(`[symlinks] Failed: ${e.message}`);
      }
    }
  }
}
