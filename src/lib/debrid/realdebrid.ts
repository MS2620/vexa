import type { DebridClient, DebridFile, DebridTorrentInfo } from "./client";

const RD_BASE = "https://api.real-debrid.com/rest/1.0";

let lastRdCall = 0;
const RD_MIN_INTERVAL_MS = 300; // ~3 RD calls/sec max

export class RealDebridClient implements DebridClient {
  constructor(private token: string) {}

  private async rdFetch(
    path: string,
    init: RequestInit = {},
  ): Promise<any> {
    const now = Date.now();
    const wait = lastRdCall + RD_MIN_INTERVAL_MS - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastRdCall = Date.now();

    const url = path.startsWith("http") ? path : `${RD_BASE}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(init.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 429) {
      console.warn("[RealDebrid] 429 too_many_requests — backing off 5s");
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (!res.ok || data.error) {
      const detail = data.error || `HTTP ${res.status}`;
      throw new Error(`Real-Debrid error: ${detail}`);
    }

    return data;
  }

  async addMagnet(magnet: string, _name?: string): Promise<{ id: string }> {
    const params = new URLSearchParams();
    params.append("magnet", magnet);

    const data = await this.rdFetch("/torrents/addMagnet", {
      method: "POST",
      body: params,
    });

    if (!data.id) {
      throw new Error("Real-Debrid: no torrent id returned");
    }

    return { id: data.id as string };
  }

  async getTorrentInfo(idOrHash: string | number): Promise<DebridTorrentInfo> {
    const data = await this.rdFetch(`/torrents/info/${idOrHash}`, {
      method: "GET",
    });

    const files: DebridFile[] = (data.files || []).map((f: any) => ({
      id: f.id,
      path: f.path,
      bytes: f.bytes,
      selected: f.selected,
    }));

    return {
      id: idOrHash,
      hash: data.hash,
      filename: data.filename,
      status: data.status,
      files,
    };
  }

  async selectFiles(
    idOrHash: string | number,
    fileIds: number[],
  ): Promise<void> {
    const params = new URLSearchParams();
    params.append("files", fileIds.join(","));

    await this.rdFetch(`/torrents/selectFiles/${idOrHash}`, {
      method: "POST",
      body: params,
    });
  }
}