import { RealDebridClient } from "./realdebrid";
import { TorboxClient } from "./torbox";

export type DebridFile = {
  id: number;
  path: string;
  bytes: number;
  selected?: number;
};

export type DebridTorrentInfo = {
  id: string | number;
  hash?: string;
  filename?: string;
  status: string;
  files: DebridFile[];
};

export interface DebridClient {
  addMagnet(magnet: string, name?: string): Promise<{ id: string | number }>;
  getTorrentInfo(idOrHash: string | number): Promise<DebridTorrentInfo>;
  selectFiles(idOrHash: string | number, fileIds: number[]): Promise<void>;
}

// Supported providers
export type DebridProvider = "realdebrid" | "torbox";

export type DebridSettings = {
  provider: DebridProvider;
  rd_token?: string;
  torbox_api_key?: string;
};

export function createDebridClient(settings: DebridSettings): DebridClient {
  const provider: DebridProvider = settings.provider || "realdebrid";

  switch (provider) {
    case "realdebrid":
      if (!settings.rd_token) {
        throw new Error("Real-Debrid token not configured");
      }
      return new RealDebridClient(settings.rd_token);

    case "torbox":
      if (!settings.torbox_api_key) {
        throw new Error("TorBox API key not configured");
      }
      return new TorboxClient(settings.torbox_api_key);

    default:
      throw new Error(`Unsupported debrid provider: ${provider}`);
  }
}