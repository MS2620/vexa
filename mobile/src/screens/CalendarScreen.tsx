import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../api";

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

type CalendarScreenProps = {
  onSelectMedia?: (id: number, type: string) => void;
};

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

export function CalendarScreen({ onSelectMedia }: CalendarScreenProps) {
  const [episodes, setEpisodes] = useState<UpcomingEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );

  useEffect(() => {
    loadUpcomingEpisodes();
  }, []);

  const episodesByDate = useMemo(() => {
    const groups = new Map<string, UpcomingEpisode[]>();
    episodes.forEach((episode) => {
      const bucket = groups.get(episode.air_date) ?? [];
      bucket.push(episode);
      groups.set(episode.air_date, bucket);
    });
    return groups;
  }, [episodes]);

  const monthCells = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }

    return cells;
  }, [currentMonthDate]);

  const selectedDateEpisodes = useMemo(() => {
    return episodesByDate.get(selectedDateKey) ?? [];
  }, [episodesByDate, selectedDateKey]);

  const monthLabel = currentMonthDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const selectedDateLabel = parseDateKey(selectedDateKey).toLocaleDateString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    },
  );

  const loadUpcomingEpisodes = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiFetch("/api/dashboard/upcoming-episodes");
      setEpisodes(Array.isArray(data?.results) ? data.results : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load upcoming episodes.");
    } finally {
      setLoading(false);
    }
  };

  const previousMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5D7AF2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Calendar</Text>

      <View style={styles.monthBar}>
        <Pressable style={styles.monthNavBtn} onPress={previousMonth}>
          <Text style={styles.monthNavText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable style={styles.monthNavBtn} onPress={nextMonth}>
          <Text style={styles.monthNavText}>{">"}</Text>
        </Pressable>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.weekHeaderRow}>
          {WEEK_DAYS.map((day) => (
            <Text key={day} style={styles.weekHeaderText}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.gridWrap}>
          {monthCells.map((date, index) => {
            if (!date) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const dateKey = toDateKey(date);
            const count = episodesByDate.get(dateKey)?.length ?? 0;
            const isSelected = dateKey === selectedDateKey;
            const isToday = dateKey === toDateKey(new Date());

            return (
              <Pressable
                key={dateKey}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDateKey(dateKey)}
              >
                <Text
                  style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                    isToday && styles.dayTextToday,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {count > 0 ? (
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderText}>{selectedDateLabel}</Text>
        <Text style={styles.listHeaderSubtext}>
          {selectedDateEpisodes.length} upcoming
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedDateEpisodes.length === 0 ? (
          <Text style={styles.emptyText}>No episodes for this day.</Text>
        ) : (
          selectedDateEpisodes.map((episode, index) => {
            const tmdbId = Number.parseInt(episode.tmdb_id, 10);
            const canOpen = Number.isFinite(tmdbId);

            return (
              <Pressable
                key={`${episode.tmdb_id}-${episode.season_number}-${episode.episode_number}-${index}`}
                style={styles.row}
                onPress={() => {
                  if (canOpen && onSelectMedia) {
                    onSelectMedia(tmdbId, "tv");
                  }
                }}
              >
                {episode.poster_path ? (
                  <Image
                    source={{
                      uri: `${TMDB_POSTER_BASE}${episode.poster_path}`,
                    }}
                    style={styles.poster}
                  />
                ) : (
                  <View style={[styles.poster, styles.posterFallback]}>
                    <Text style={styles.posterFallbackText}>TV</Text>
                  </View>
                )}

                <View style={styles.meta}>
                  <Text style={styles.showName} numberOfLines={1}>
                    {episode.show_name}
                  </Text>
                  <Text style={styles.episodeMeta} numberOfLines={1}>
                    S{episode.season_number} E{episode.episode_number}
                  </Text>
                  <Text style={styles.episodeName} numberOfLines={1}>
                    {episode.episode_name}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  header: {
    color: "#F5F7FF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  monthBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
    backgroundColor: "#121626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#161A2B",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: {
    color: "#9BA6CC",
    fontSize: 18,
    fontWeight: "700",
    marginTop: -1,
  },
  monthLabel: {
    color: "#F5F7FF",
    fontSize: 15,
    fontWeight: "700",
  },
  calendarCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2540",
    backgroundColor: "#121626",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekHeaderText: {
    width: "14.2857%",
    textAlign: "center",
    color: "#8088A7",
    fontSize: 11,
    fontWeight: "700",
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  dayCell: {
    width: "14.2857%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: "#263E9A",
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: "#5D7AF2",
  },
  dayText: {
    color: "#AEB8DA",
    fontSize: 13,
    fontWeight: "600",
  },
  dayTextSelected: {
    color: "#FFFFFF",
  },
  dayTextToday: {
    color: "#DCE4FF",
  },
  countPill: {
    marginTop: 2,
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    height: 14,
    backgroundColor: "#5D7AF2",
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  listHeaderRow: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listHeaderText: {
    color: "#F5F7FF",
    fontSize: 14,
    fontWeight: "700",
  },
  listHeaderSubtext: {
    color: "#9BA6CC",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2540",
    backgroundColor: "#121626",
  },
  poster: {
    width: 48,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#141A2F",
  },
  posterFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  posterFallbackText: {
    color: "#7A85AF",
    fontSize: 12,
    fontWeight: "700",
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  showName: {
    color: "#F5F7FF",
    fontSize: 15,
    fontWeight: "700",
  },
  episodeMeta: {
    color: "#86A1FF",
    fontSize: 12,
    fontWeight: "700",
  },
  episodeName: {
    color: "#AEB8DA",
    fontSize: 12,
  },
  emptyText: {
    color: "#9BA6CC",
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
  },
  errorText: {
    color: "#FF7373",
    fontSize: 15,
    textAlign: "center",
  },
});
