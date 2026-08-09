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

  // Skip silently if the zurg mount isn't available
  try {
    await fs.access(DEBRID_MOUNT);
  } catch {
    console.warn(
      `[symlinks] ${DEBRID_MOUNT} not accessible — skipping symlink creation`,
    );
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  // Fetch release year from TMDB
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

  // Only link selected video files
  const videoFiles = infoData.files.filter(
    (f) => f.selected === 1 && /\.(mkv|mp4|avi)$/i.test(f.path),
  );

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No selected video files found for "${title}"`);
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  for (const file of videoFiles) {
    // Build source path
    const parts = file.path.replace(/^\//, "").split("/");
    const sourcePath =
      parts.length === 1
        ? path.join(DEBRID_MOUNT, infoData.filename, parts[0])
        : path.join(DEBRID_MOUNT, file.path);

    // Create Plex symlinks (soft symlinks - Plex supports these)
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
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "EEXIST") {
        plexPaths.push(plexTargetPath);
      } else {
        console.error(`[plex] Failed: ${err.message}`);
      }
    }

    // Create Jellyfin hard links (hard links - Jellyfin requires these)
    const jellyfinTargetDir = path.join(
      JELLYFIN_LINK_ROOT,
      mediaType === "movie" ? "Movies" : "TV_Shows",
      folderName,
      ...(mediaType === "tv"
        ? [`Season ${String(season ?? 1).padStart(2, "0")}`]
        : []),
    );

    await fs.mkdir(jellyfinTargetDir, { recursive: true });
    const jellyfinTargetPath = path.join(
      jellyfinTargetDir,
      path.basename(file.path),
    );

    try {
      await fs.link(sourcePath, jellyfinTargetPath);
      console.log(`[jellyfin] ${jellyfinTargetPath} => ${sourcePath}`);
      jellyfinPaths.push(jellyfinTargetPath);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "EXDEV") {
        // Cross-filesystem - fall back to symlink for Jellyfin (won't work ideally, but better than nothing)
        console.warn(
          `[jellyfin] EXDEV - falling back to symlink for ${jellyfinTargetPath}`,
        );
        try {
          await fs.symlink(sourcePath, jellyfinTargetPath);
          jellyfinPaths.push(jellyfinTargetPath);
        } catch {
          // Ignore if even symlink fails
        }
      } else if (err.code === "EEXIST") {
        jellyfinPaths.push(jellyfinTargetPath);
      } else {
        console.error(`[jellyfin] Failed: ${err.message}`);
      }
    }
  }

  return { plex: plexPaths, jellyfin: jellyfinPaths };
}