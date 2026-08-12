import type { DebridClient, DebridTorrentInfo, DebridFile } from "./client";

const TORBOX_BASE = "https://api.torbox.app/v1/api";

export class TorboxClient implements DebridClient {
  constructor(private apiKey: string) {}

  private async tbFetch(
    path: string,
    init: RequestInit & { asJson?: boolean } = {},
  ): Promise<any> {
    const url = `${TORBOX_BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      const detail = data?.detail || `HTTP ${res.status}`;
      throw new Error(`TorBox API error: ${detail}`);
    }

    return data;
  }

  async addMagnet(magnet: string, name?: string) {
    // POST /torrents/createtorrent
    // body: { magnet, name?, seeding?, allowZip? }
    const payload: any = { magnet };
    if (name) payload.name = name;

    const data = await this.tbFetch("/torrents/createtorrent", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // API returns something like { success: true, detail: "...", torrent_id, hash }
    const id = data.torrent_id ?? data.id ?? data.hash;
    if (!id) {
      throw new Error("TorBox: no torrent id/hash returned");
    }

    return { id };
  }

  async getTorrentInfo(idOrHash: string | number): Promise<DebridTorrentInfo> {
    // POST /torrents/torrentinfo with { torrent_id } or { hash }
    const payload: any = {};

    if (typeof idOrHash === "number" || /^\d+$/.test(String(idOrHash))) {
      payload.torrent_id = Number(idOrHash);
    } else {
      payload.hash = idOrHash;
    }

    const data = await this.tbFetch("/torrents/torrentinfo", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Map TorBox structure -> DebridTorrentInfo
    // You may need to tweak based on exact response shape
    const files: DebridFile[] =
      (data.files || data.file_list || []).map((f: any, idx: number) => ({
        id: f.id ?? idx,
        path: f.path ?? f.name ?? "",
        bytes: f.size ?? f.length ?? 0,
        selected: f.selected ? 1 : 0,
      }));

    return {
      id: data.torrent_id ?? data.id ?? idOrHash,
      hash: data.hash,
      status: data.status ?? data.state ?? "unknown",
      files,
    };
  }

  async selectFiles(idOrHash: string | number, fileIds: number[]): Promise<void> {
    // TorBox does not have a direct equivalent to RD's selectFiles in the same way.
    // Usually, all files are available once the torrent is cached/downloaded.
    // If they add a per-file selection API, call it here.
    // For now, this is a no-op.
    return;
  }
}