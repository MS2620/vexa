"use client";

import { KeywordData, MediaDetail } from "@/lib/types";

type InfoSidebarProps = {
  detail: MediaDetail;
  keywords: KeywordData[];
};

export default function InfoSidebar({ detail, keywords }: InfoSidebarProps) {
  return (
    <div className="w-full lg:w-80 shrink-0">
      <div className="sticky top-24 space-y-6">
        <div className="bg-[#161824] border border-white/5 rounded-2xl p-6 shadow-xl shadow-black/20">
          <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            Information
          </h3>
          <div className="space-y-4">
            {[
              {
                label: "Original Name",
                value: detail.original_title || detail.original_name,
              },
              {
                label: "First Air Date",
                value: detail.first_air_date || detail.release_date,
              },
              {
                label: "Next Air Date",
                value: detail.next_episode_to_air?.air_date,
              },
              {
                label: "Language",
                value: detail.original_language?.toUpperCase(),
              },
              {
                label: "Network",
                value:
                  detail.networks?.[0]?.name ||
                  detail.production_companies?.[0]?.name,
              },
              {
                label: "Budget",
                value: detail.budget
                  ? `$${(detail.budget / 1000000).toFixed(1)}M`
                  : null,
              },
              {
                label: "Revenue",
                value: detail.revenue
                  ? `$${(detail.revenue / 1000000).toFixed(1)}M`
                  : null,
              },
            ]
              .filter((item) => item.value)
              .map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {label}
                  </span>
                  <span className="text-sm font-medium text-gray-200">
                    {value}
                  </span>
                </div>
              ))}
          </div>
        </div>
        {keywords.length > 0 && (
          <div className="bg-[#161824] border border-white/5 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
              Keywords
            </h3>
            <div className="flex flex-wrap gap-2">
              {keywords.slice(0, 20).map((kw) => (
                <span
                  key={kw.id}
                  className="text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300"
                >
                  {kw.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
