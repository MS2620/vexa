import fs from "fs/promises";
import path from "path";
import type { DebridFile } from "./debrid/client";

// Mount directories with fallback support for both naming conventions
const MOUNT_PATHS: Record<string, string> = {
  torbox:
    process.env.TORBOX_MOUNT_PATH ||
    process.env.TORBOX_MOUNT ||
    "/mnt/torbox",
  realdebrid:
    process.env.RD_MOUNT_PATH ||
    process.env.DEBRID_MOUNT ||
    "/mnt/realdebrid",
};

const MEDIA_BASE =
  process.env.MEDIA_BASE_PATH ||
  process.env.PLEX_SYMLINK_ROOT ||
  process.env.JELLYFIN_LINK_ROOT ||
  "/mnt/media";

interface SymlinkOptions {
  infoData: {
    filename: string;
    files: Array<DebridFile | { id: number | string; path: string; bytes: number }>;
  };
  title: string;
  tmdbId?: number | string | null;
  mediaType: "movie" | "tv";
  season?: number | string | null;
  episode?: number | string | null;
  tmdbKey?: string;
  provider?: "realdebrid" | "torbox" | string;
}

// Strip invalid OS path characters
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ").trim();
}

// Extract or resolve Season and Episode numbers
function resolveEpisodeTag(
  filePath: string,
  fallbackSeason: number | null,
  fallbackEpisode: number | null,
): { season: number; episode: number } {
  const name = path.basename(filePath);

  // Match S01E06, s1e6, 1x06
  const seMatch = name.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (seMatch) {
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
    };
  }

  const xMatch = name.match(/(\d{1,2})[xX](\d{1,3})/);
  if (xMatch) {
    return {
      season: parseInt(xMatch[1], 10),
      episode: parseInt(xMatch[2], 10),
    };
  }

  // Match standalone Exx when season is provided
  const eOnlyMatch = name.match(/[Ee](\d{2,3})(?!\d)/);
  if (eOnlyMatch && fallbackSeason) {
    return {
      season: fallbackSeason,
      episode: parseInt(eOnlyMatch[1], 10),
    };
  }

  // Match leading number in episode files (e.g., "01 - Episode Title.mkv")
  const leadingNumMatch = name.match(/^(\d{1,2})\s*[-_.]/);
  if (leadingNumMatch && fallbackSeason) {
    return {
      season: fallbackSeason,
      episode: parseInt(leadingNumMatch[1], 10),
    };
  }

  return {
    season: fallbackSeason ?? 1,
    episode: fallbackEpisode ?? 1,
  };
}

function formatEpisodeTag(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

// Build exact source path regardless of single-file vs folder torrents
function resolveSourcePath(
  sourceMount: string,
  torrentName: string,
  filePath: string,
): string {
  const cleanFilePath = filePath.replace(/^\//, "");
  const cleanTorrentName = torrentName.replace(/^\//, "").trim();

  if (cleanFilePath === cleanTorrentName) {
    return path.join(sourceMount, cleanFilePath);
  }

  if (
    cleanFilePath.startsWith(cleanTorrentName + "/") ||
    cleanFilePath.startsWith(cleanTorrentName + "\\")
  ) {
    return path.join(sourceMount, cleanFilePath);
  }

  return path.join(sourceMount, cleanTorrentName, cleanFilePath);
}

export async function createSymlinks({
  infoData,
  title,
  tmdbId,
  mediaType,
  season = null,
  episode = null,
  tmdbKey,
  provider = "realdebrid",
}: SymlinkOptions): Promise<{ plex: string[]; jellyfin: string[] }> {
  const sourceMount = MOUNT_PATHS[provider] || MOUNT_PATHS.realdebrid;
  const createdPaths: string[] = [];

  // Verify mount accessibility before attempting symlinking
  try {
    await fs.access(sourceMount);
  } catch {
    console.warn(
      `[symlinks] Mount path "${sourceMount}" is not accessible — skipping symlink creation.`,
    );
    return { plex: [], jellyfin: [] };
  }

  // Fetch release year from TMDB if API key is provided
  let year = "";
  if (tmdbId && tmdbKey) {
    try {
      const endpoint =
        mediaType === "movie"
          ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`
          : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const dateStr =
          mediaType === "movie" ? data.release_date : data.first_air_date;
        if (dateStr) year = (dateStr as string).slice(0, 4);
      }
    } catch {
      // Continue without year on TMDB API failure
    }
  }

  const cleanTitle = sanitizeFilename(title);
  const titleWithYear = year ? `${cleanTitle} (${year})` : cleanTitle;

  // Filter video files (> 30MB, valid extensions, non-sample)
  const videoFiles = infoData.files.filter((f) => {
    const isVideo = /\.(mkv|mp4|avi)$/i.test(f.path);
    const isNotSample = !f.path.toLowerCase().includes("sample");
    const isLargeEnough = f.bytes > 30 * 1024 * 1024;
    return isVideo && isNotSample && isLargeEnough;
  });

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No valid video files found for "${title}"`);
    return { plex: [], jellyfin: [] };
  }

  const parsedSeason = season ? parseInt(season.toString(), 10) : null;
  const parsedEpisode = episode ? parseInt(episode.toString(), 10) : null;

  if (mediaType === "tv") {
    for (const file of videoFiles) {
      const sourcePath = resolveSourcePath(
        sourceMount,
        infoData.filename,
        file.path,
      );

      const resolved = resolveEpisodeTag(
        file.path,
        parsedSeason,
        parsedEpisode,
      );
      const epTag = formatEpisodeTag(resolved.season, resolved.episode);
      const seasonFolder = `Season ${String(resolved.season).padStart(2, "0")}`;

      const targetDir = path.join(
        MEDIA_BASE,
        "TV Shows",
        titleWithYear,
        seasonFolder,
      );
      await fs.mkdir(targetDir, { recursive: true });

      const originalFileName = path.basename(file.path);
      const ext = path.extname(originalFileName) || ".mkv";

      // If original file already contains SxxExx, preserve it; otherwise prepend title & SxxExx
      let fileName: string;
      if (/[Ss]\d{1,2}[Ee]\d{1,3}/.test(originalFileName)) {
        fileName = originalFileName;
      } else {
        fileName = `${cleanTitle} - ${epTag} - ${originalFileName}`;
      }

      const targetPath = path.join(targetDir, fileName);

      // Clean existing/broken symlinks before creating a new one
      try {
        await fs.unlink(targetPath);
      } catch {
        // Ignore if file doesn't exist
      }

      try {
        await fs.symlink(sourcePath, targetPath);
        console.log(`[symlink] ${targetPath} → ${sourcePath}`);
        createdPaths.push(targetPath);
      } catch (e: any) {
        console.error(`[symlink] Failed to create symlink: ${e.message}`);
      }
    }
  } else {
    // Movies logic
    const targetDir = path.join(MEDIA_BASE, "Movies", titleWithYear);
    await fs.mkdir(targetDir, { recursive: true });

    for (const file of videoFiles) {
      const sourcePath = resolveSourcePath(
        sourceMount,
        infoData.filename,
        file.path,
      );
      const originalFileName = path.basename(file.path);
      const targetPath = path.join(targetDir, originalFileName);

      try {
        await fs.unlink(targetPath);
      } catch {
        // Ignore
      }

      try {
        await fs.symlink(sourcePath, targetPath);
        console.log(`[symlink] ${targetPath} → ${sourcePath}`);
        createdPaths.push(targetPath);
      } catch (e: any) {
        console.error(`[symlink] Failed to create symlink: ${e.message}`);
      }
    }
  }

  return {
    plex: createdPaths,
    jellyfin: createdPaths,
  };
}