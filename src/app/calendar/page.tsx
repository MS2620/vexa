"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Tv } from "lucide-react";
import { useRouter } from "next/navigation";

type UpcomingEpisode = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string;
  air_date: string;
  tmdb_id: string;
};

export default function CalendarPage() {
  const [episodes, setEpisodes] = useState<UpcomingEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    fetch("/api/dashboard/upcoming-episodes")
      .then((res) => res.json())
      .then((data) => {
        setEpisodes(data.results || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch episodes:", err);
        setLoading(false);
      });
  }, []);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentYear, currentMonth, i));
  }

  const getEpisodesForDate = (date: Date) => {
    if (!date) return [];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    return episodes.filter((ep) => ep.air_date === dateString);
  };

  return (
    <div className="pt-4 pb-12 px-4 md:px-8 xl:px-12 animate-in fade-in duration-500 max-w-[1800px] w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-indigo-500" /> Calendar
          </h1>
          <p className="text-gray-400 text-sm">Track upcoming episodes for series in your library</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[#161824] border border-white/5 rounded-xl p-2 shadow-lg shadow-black/20">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-[120px] text-center font-semibold text-white">
            {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-[#161824] border border-white/5 rounded-2xl shadow-xl shadow-black/40 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/5 bg-[#0f111a]/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center md:text-left">
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((date, index) => {
              const isToday = date && 
                date.getDate() === today.getDate() && 
                date.getMonth() === today.getMonth() && 
                date.getFullYear() === today.getFullYear();
              
              const dayEpisodes = date ? getEpisodesForDate(date) : [];
              const isPast = date ? date < new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;

              return (
                <div 
                  key={index} 
                  className={`
                    min-h-[120px] sm:min-h-[140px] md:min-h-[180px] lg:min-h-[220px] xl:min-h-[260px] p-1 md:p-2 border-b border-r border-white/5 last:border-r-0 relative flex flex-col
                    ${!date ? 'bg-[#0f111a]/20' : 'hover:bg-white/[0.02] transition-colors'}
                    ${isToday ? 'bg-indigo-500/5' : ''}
                    ${index % 7 === 6 ? 'border-r-0' : ''}
                  `}
                >
                  {date && (
                    <>
                      <div className={`
                        w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold mb-1 mx-auto md:mx-0 shrink-0
                        ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 
                          isPast ? 'text-gray-600' : 'text-gray-400'}
                      `}>
                        {date.getDate()}
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-1 mt-1 space-y-1 overflow-y-auto max-h-[80px] sm:max-h-[100px] md:max-h-[135px] lg:max-h-[175px] xl:max-h-[215px] scrollbar-hide">
                        {dayEpisodes.map((ep, i) => (
                          <div 
                            key={`${ep.tmdb_id}-${i}`}
                            onClick={() => router.push(`/media/tv/${ep.tmdb_id}`)}
                            className={`
                              group cursor-pointer rounded overflow-hidden relative flex flex-col md:flex-row
                              ${isPast ? 'opacity-50 hover:opacity-100' : ''}
                              bg-[#0f111a]/80 border border-white/5 hover:border-indigo-500/50 transition-colors shrink-0
                            `}
                            title={`${ep.show_name} - S${ep.season_number}E${ep.episode_number}: ${ep.episode_name}`}
                          >
                            <div className="hidden md:block w-8 sm:w-10 h-12 sm:h-14 bg-gray-800 shrink-0">
                              {ep.poster_path ? (
                                <img 
                                  src={`https://image.tmdb.org/t/p/w200${ep.poster_path}`} 
                                  alt={ep.show_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Tv className="w-4 h-4 text-gray-600" />
                                </div>
                              )}
                            </div>
                            <div className="p-1.5 md:p-2 flex flex-col justify-center min-w-0 flex-1">
                              <span className="text-[10px] sm:text-xs font-semibold text-white truncate px-1 md:px-0">
                                {ep.show_name}
                              </span>
                              <span className="text-[9px] sm:text-[10px] text-gray-400 truncate hidden md:block">
                                S{ep.season_number} E{ep.episode_number}
                              </span>
                              <span className="text-[9px] sm:text-[10px] text-indigo-400 font-mono hidden md:block truncate mt-0.5">
                                {ep.episode_name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}