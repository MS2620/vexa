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

export function CalendarScreen({ onSelectMedia }: CalendarScreenProps) {
  const [episodes, setEpisodes] = useState<UpcomingEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUpcomingEpisodes();
  }, []);

  const groupedEpisodes = useMemo(() => {
    const groups = new Map<string, UpcomingEpisode[]>();
    episodes.forEach((episode) => {
      const key = episode.air_date;
      const bucket = groups.get(key) ?? [];
      bucket.push(episode);
      groups.set(key, bucket);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items,
      }));
  }, [episodes]);

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

  const formatDate = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedEpisodes.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming episodes found.</Text>
        ) : (
          groupedEpisodes.map((group) => (
            <View key={group.date} style={styles.groupWrap}>
              <Text style={styles.groupDate}>{formatDate(group.date)}</Text>
              <View style={styles.groupCard}>
                {group.items.map((episode, index) => {
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
                })}
              </View>
            </View>
          ))
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
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  groupWrap: {
    gap: 8,
  },
  groupDate: {
    color: "#9BA6CC",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2540",
    backgroundColor: "#121626",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2035",
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
    fontSize: 16,
    textAlign: "center",
    marginTop: 24,
  },
  errorText: {
    color: "#FF7373",
    fontSize: 15,
    textAlign: "center",
  },
});
