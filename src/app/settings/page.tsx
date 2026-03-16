"use client";
import { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  SkipForward,
} from "lucide-react";

type SyncItem = {
  status: "synced" | "skipped" | "failed";
  filename: string;
  title?: string;
  reason?: string;
};
type SyncSummary = { synced: number; skipped: number; failed: number };

export default function Settings() {
  const [formData, setFormData] = useState({
    tmdb_key: "",
    rd_token: "",
    plex_url: "",
    plex_token: "",
    plex_lib_id: "",
    plex_tv_lib_id: "",
    preferred_resolution: "1080p",
    preferred_language: "en",
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
  });
  const [saveStatus, setSaveStatus] = useState("");
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [syncState, setSyncState] = useState<"idle" | "running" | "done">(
    "idle",
  );
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const handleSync = async () => {
    setSyncState("running");
    setSyncItems([]);
    setSyncProgress({ current: 0, total: 0 });
    setSyncSummary(null);

    const res = await fetch("/api/symlinks/sync", { method: "POST" });
    if (!res.ok || !res.body) {
      setSyncState("done");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "total")
            setSyncProgress({ current: 0, total: event.count });
          else if (event.type === "progress")
            setSyncProgress({ current: event.current, total: event.total });
          else if (event.type === "item")
            setSyncItems((prev) => [...prev.slice(-49), event]);
          else if (event.type === "done") {
            setSyncSummary(event);
            setSyncState("done");
          } else if (event.type === "error") setSyncState("done");
        } catch {
          /* malformed line */
        }
      }
    }
  };

  // Load saved settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setFormData((prev) => ({ ...prev, ...data })));
  }, []);

  // Load live service status
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setServiceStatus(data);
        setStatusLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaveStatus("Saving...");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setSaveStatus("Saved successfully!");
    setTimeout(() => setSaveStatus(""), 3000);
  };

  return (
    <div className="max-w-3xl mt-6 animate-in fade-in space-y-8">
      <h1 className="text-2xl font-bold">Configuration</h1>

      {/* ── LIVE STATUS PANEL ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Real-Debrid Card */}
        <div className="bg-[#161824] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Real-Debrid</h3>
            {statusLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full font-bold border ${
                  serviceStatus?.rd?.status === "connected"
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-red-600/20 text-red-400 border-red-600/30"
                }`}
              >
                {serviceStatus?.rd?.status === "connected"
                  ? "● Connected"
                  : "● Error"}
              </span>
            )}
          </div>
          {serviceStatus?.rd?.user && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Username</span>
                <span className="text-white">
                  {serviceStatus.rd.user.username}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Premium Days Left</span>
                <span
                  className={
                    serviceStatus.rd.user.premium > 2592000
                      ? "text-green-400"
                      : "text-yellow-400"
                  }
                >
                  {Math.floor(serviceStatus.rd.user.premium / 86400)} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Points</span>
                <span className="text-white">
                  {serviceStatus.rd.user.points?.toLocaleString()}
                </span>
              </div>
            </div>
          )}
          {serviceStatus?.rd?.torrents?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                Recent Torrents
              </p>
              <div className="space-y-2">
                {serviceStatus.rd.torrents.slice(0, 3).map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <p className="text-xs text-gray-300 truncate flex-1">
                      {t.filename}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        t.status === "downloaded"
                          ? "bg-green-900/30 text-green-400"
                          : t.status === "downloading"
                            ? "bg-blue-900/30 text-blue-400"
                            : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Plex Card */}
        <div className="bg-[#161824] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Plex</h3>
            {statusLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : (
              <span
                className={`text-xs px-2 py-1 rounded-full font-bold border ${
                  serviceStatus?.plex?.status === "connected"
                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                    : "bg-red-600/20 text-red-400 border-red-600/30"
                }`}
              >
                {serviceStatus?.plex?.status === "connected"
                  ? "● Connected"
                  : "● Unreachable"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {statusLoading
              ? "Checking connection..."
              : serviceStatus?.plex?.status === "connected"
                ? "Plex server is reachable and responding."
                : "Cannot reach Plex. Check your URL and token below."}
          </p>
        </div>
      </div>

      {/* ── CONFIGURATION FORM ── */}
      <div className="bg-[#161824] border border-gray-800/50 rounded-xl p-8 space-y-6">
        {/* Core API Keys */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            API Keys
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                TMDB API Key
              </label>
              <input
                type="password"
                value={formData.tmdb_key || ""}
                onChange={(e) =>
                  setFormData({ ...formData, tmdb_key: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Real-Debrid Token
              </label>
              <input
                type="password"
                value={formData.rd_token || ""}
                onChange={(e) =>
                  setFormData({ ...formData, rd_token: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* Plex */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Plex
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex Local URL
              </label>
              <input
                type="text"
                placeholder="http://192.168.1.X:32400"
                value={formData.plex_url || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_url: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex Token
              </label>
              <input
                type="password"
                value={formData.plex_token || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_token: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex Movie Library ID
              </label>
              <input
                type="text"
                placeholder="e.g. 1"
                value={formData.plex_lib_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_lib_id: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Plex TV Library ID
              </label>
              <input
                type="text"
                placeholder="e.g. 2"
                value={formData.plex_tv_lib_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, plex_tv_lib_id: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* Stream Preferences */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Stream Preferences
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Preferred Resolution
              </label>
              <select
                value={formData.preferred_resolution || "1080p"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferred_resolution: e.target.value,
                  })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500 text-white"
              >
                <option value="2160p">4K (2160p)</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Preferred Language
              </label>
              <select
                value={formData.preferred_language || "en"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preferred_language: e.target.value,
                  })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500 text-white"
              >
                <option value="en">English</option>
                <option value="multi">Multi</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* SMTP Notifications */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Email Notifications (SMTP)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Host
              </label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={formData.smtp_host || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_host: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Port
              </label>
              <input
                type="text"
                placeholder="587"
                value={formData.smtp_port || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_port: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Username
              </label>
              <input
                type="text"
                value={formData.smtp_user || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_user: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                SMTP Password
              </label>
              <input
                type="password"
                value={formData.smtp_pass || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_pass: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">
                From Address
              </label>
              <input
                type="email"
                placeholder="seerr@yourdomain.com"
                value={formData.smtp_from || ""}
                onChange={(e) =>
                  setFormData({ ...formData, smtp_from: e.target.value })
                }
                className="w-full bg-[#0f111a] border border-gray-700 rounded-lg p-3 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex items-center justify-between border-t border-gray-800">
          <span className="text-green-400 text-sm">{saveStatus}</span>
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            <Save className="w-5 h-5" /> Save Configuration
          </button>
        </div>
      </div>

      {/* ── LIBRARY SYNC ── */}
      <div className="bg-[#161824] border border-gray-800/50 rounded-xl p-8 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">
            Library Sync
          </h2>
          <p className="text-sm text-gray-500">
            Scan your existing Real-Debrid library and create Plex symlinks for
            all downloaded torrents. Safe to re-run — existing symlinks are
            skipped.
          </p>
        </div>

        {/* Progress bar */}
        {syncState === "running" && syncProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Processing torrents…</span>
              <span>
                {syncProgress.current} / {syncProgress.total}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{
                  width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {syncSummary && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">
              ✓ {syncSummary.synced} synced
            </span>
            <span className="text-yellow-400">
              ⊘ {syncSummary.skipped} skipped
            </span>
            <span className="text-red-400">✗ {syncSummary.failed} failed</span>
          </div>
        )}

        {/* Results list — last 50 items */}
        {syncItems.length > 0 && (
          <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg bg-[#0f111a] border border-gray-800 p-3">
            {syncItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {item.status === "synced" && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                )}
                {item.status === "skipped" && (
                  <SkipForward className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                )}
                {item.status === "failed" && (
                  <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-gray-300 truncate block">
                    {item.title ?? item.filename}
                  </span>
                  {item.reason && (
                    <span className="text-gray-600">{item.reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncState === "running"}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:text-indigo-400 rounded-lg text-sm font-medium transition-colors"
        >
          {syncState === "running" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Syncing…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" /> Sync RD Library
            </>
          )}
        </button>
      </div>
    </div>
  );
}
