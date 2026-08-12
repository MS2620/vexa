import type { DebridClient, DebridTorrentInfo, DebridFile } from "./client";

const TORBOX_BASE = "https://api.torbox.app/v1/api";

export class TorboxClient implements DebridClient {
  constructor(private apiKey: string) {}

  private async tbFetch(
    path: string,
    init: RequestInit = {},
  ): Promise<any> {
    const url = `${TORBOX_BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      const detail = data?.detail || data?.error || `HTTP ${res.status}`;
      throw new Error(`TorBox API error: ${detail}`);
    }

    return data;
  }

  async addMagnet(magnet: string, name?: string) {
    // POST /torrents/createtorrent — must be multipart/form-data
    const form = new FormData();
    form.append("magnet", magnet);
    if (name) form.append("name", name);

    // Do NOT set Content-Type manually — fetch sets the multipart boundary itself
    const data = await this.tbFetch("/torrents/createtorrent", {
      method: "POST",
      body: form,
    });

    const id = data?.data?.torrent_id ?? data?.data?.id ?? data?.data?.hash;
    if (!id) {
      throw new Error("TorBox: no torrent id/hash returned");
    }

    return { id };
  }

  async getTorrentInfo(idOrHash: string | number): Promise<DebridTorrentInfo> {
    // For a torrent already added to your account, look it up via mylist?id=
    const isNumericId =
      typeof idOrHash === "number" || /^\d+$/.test(String(idOrHash));

    let record: any;

    if (isNumericId) {
      const data = await this.tbFetch(
        `/torrents/mylist?id=${Number(idOrHash)}&bypass_cache=true`,
        { method: "GET" },
      );
      record = data?.data;
    } else {
      // Fallback: lookup by hash via the torrentinfo route (pre-add metadata check)
      const data = await this.tbFetch("/torrents/torrentinfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: idOrHash }),
      });
      record = data?.data;
    }

    const rawFiles = record?.files || [];

    const files: DebridFile[] = rawFiles.map((f: any, idx: number) => ({
      id: f.id ?? idx,
      path: f.short_name ?? f.name ?? f.path ?? "",
      bytes: f.size ?? f.length ?? 0,
      selected: 1,
    }));

    return {
      id: record?.id ?? record?.torrent_id ?? idOrHash,
      hash: record?.hash,
      status: record?.download_state ?? record?.status ?? "unknown",
      files,
    };
  }

  async selectFiles(_idOrHash: string | number, _fileIds: number[]): Promise<void> {
    // TorBox downloads all files automatically — no file-selection API exists.
    return;
  }
}