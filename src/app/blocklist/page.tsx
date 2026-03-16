"use client";
import { useState, useEffect } from "react";
import { Trash2, ShieldBan, Loader2 } from "lucide-react";

export default function BlocklistPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocklist = async () => {
    const res = await fetch("/api/blocklist");
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    const loadBlocklist = async () => {
      await fetchBlocklist();
    };
    loadBlocklist();
  }, []);

  const handleRemove = async (infoHash: string) => {
    await fetch("/api/blocklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ infoHash }),
    });
    fetchBlocklist();
  };

  return (
    <div className="pt-6 animate-in fade-in max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">Blocklist</h1>
          <p className="text-sm text-gray-400 mt-1">
            Hashes in this list will never appear in stream results.
          </p>
        </div>
        <span className="text-sm text-gray-500">{items.length} blocked</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500 gap-4">
          <ShieldBan className="w-12 h-12 opacity-30" />
          <p>No blocked streams yet.</p>
          <p className="text-xs text-gray-600">
            Use the 🚫 button in the stream modal to block a torrent.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-[#161824] border border-gray-800 rounded-xl p-4 flex items-center gap-4"
            >
              <ShieldBan className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{item.title}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                  {item.info_hash}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Blocked by {item.added_by} ·{" "}
                  {new Date(item.added_at).toLocaleDateString("en-GB")}
                </p>
              </div>
              <button
                onClick={() => handleRemove(item.info_hash)}
                className="p-2 hover:bg-red-900/30 rounded-lg text-gray-400 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
