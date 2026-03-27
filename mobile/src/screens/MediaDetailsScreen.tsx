import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { apiFetch } from "../api";
import { StreamModal } from "../components/StreamModal";

interface MediaDetailsScreenProps {
  id: number;
  type: string; // 'movie' | 'tv' | 'series' (series usually mapped to 'tv' for tmdb)
  onBack: () => void;
}

export function MediaDetailsScreen({
  id,
  type,
  onBack,
}: MediaDetailsScreenProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  // Stream modal state
  const [streamModalVisible, setStreamModalVisible] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | undefined>();
  const [selectedEpisode, setSelectedEpisode] = useState<number | undefined>();

  // Map 'series' to 'tv' if needed to match TMDB requirements
  const tmdbType = type === "series" ? "tv" : type;

  useEffect(() => {
    loadDetails();
  }, [id, tmdbType]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      setError("");
      const { data: resData } = await apiFetch(`/api/media/${tmdbType}/${id}`);
      if (resData?.detail) {
        setData(resData);
      } else {
        setError("Failed to load media details.");
      }
    } catch (err: any) {
      setError(err.message || "Error fetching details");
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = (seasonNum?: number, episodeNum?: number) => {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(episodeNum);
    setStreamModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5D7AF2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  const detail = data.detail;
  const credits = data.credits;
  const availability = data.plexAvailability || {};

  const displayTitle = detail.title || detail.name || "Unknown Title";
  const displayDate = detail.release_date || detail.first_air_date;
  const year = displayDate ? displayDate.substring(0, 4) : "";

  const backdropUrl = detail.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`
    : null;

  const posterUrl = detail.poster_path
    ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Image";

  // Determine global availability
  const isMovieAvailable =
    tmdbType === "movie" && availability["movie"] === "available";

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={styles.backdrop} />
        ) : (
          <View style={[styles.backdrop, { backgroundColor: "#141A32" }]} />
        )}

        <View style={styles.headerArea}>
          <Image source={{ uri: posterUrl }} style={styles.poster} />
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{displayTitle}</Text>
            <View style={styles.metaRow}>
              {year ? <Text style={styles.metaText}>{year}</Text> : null}
              {detail.vote_average ? (
                <Text style={styles.metaText}>
                  ⭐ {detail.vote_average.toFixed(1)}
                </Text>
              ) : null}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tmdbType.toUpperCase()}</Text>
              </View>
            </View>

            {tmdbType === "movie" && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <View
                  style={[
                    styles.statusBadge,
                    isMovieAvailable
                      ? styles.statusAvail
                      : styles.statusUnavail,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {isMovieAvailable ? "Available on Plex" : "Not on Plex"}
                  </Text>
                </View>
                {!isMovieAvailable && (
                  <Pressable
                    style={styles.requestBtn}
                    onPress={() => handleRequest()}
                    disabled={requesting}
                  >
                    <Text style={styles.requestBtnText}>
                      {requesting ? "..." : "Request"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.overview}>
            {detail.overview || "No overview available."}
          </Text>
        </View>

        {tmdbType === "tv" && detail.seasons && detail.seasons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seasons</Text>
            {detail.seasons.map((season: any) => {
              const status = availability[season.season_number];
              let statusColor = "#B7C0E3";
              if (status === "available") statusColor = "#4ADE80"; // green
              if (status === "partial") statusColor = "#FBBF24"; // yellow
              if (status === "unavailable") statusColor = "#F87171"; // red

              return (
                <View key={season.id} style={styles.seasonRow}>
                  <Text style={styles.seasonName}>
                    {season.name || `Season ${season.season_number}`}
                  </Text>
                  <Text style={styles.seasonEpCount}>
                    {season.episode_count} Episodes
                  </Text>
                  <View style={styles.seasonStatus}>
                    <Text
                      style={[styles.seasonStatusText, { color: statusColor }]}
                    >
                      {status ? status.toUpperCase() : "UNKNOWN"}
                    </Text>
                    {status !== "available" && (
                      <Pressable
                        style={[styles.requestBtn, { marginTop: 8 }]}
                        onPress={() => handleRequest(season.season_number)}
                      >
                        <Text style={styles.requestBtnText}>Request</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <StreamModal
        visible={streamModalVisible}
        onClose={() => setStreamModalVisible(false)}
        tmdbId={id}
        type={tmdbType}
        season={selectedSeason}
        episode={selectedEpisode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1223",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0D1223",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A335A",
    backgroundColor: "#0D1223",
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backBtnText: {
    color: "#5D7AF2",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backdrop: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  headerArea: {
    flexDirection: "row",
    padding: 16,
    marginTop: -60,
  },
  poster: {
    width: 100,
    height: 150,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#0D1223",
    backgroundColor: "#141A32",
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    marginTop: 60,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  title: {
    color: "#F6F8FF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  metaText: {
    color: "#9BA6CC",
    fontSize: 14,
  },
  badge: {
    backgroundColor: "#263E9A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: "#F7F9FF",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  statusAvail: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
  },
  statusUnavail: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: "#F6F8FF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  overview: {
    color: "#AEB8DA",
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: "#ff4b4b",
    fontSize: 16,
    marginBottom: 16,
  },
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#141A32",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  seasonName: {
    color: "#F6F8FF",
    fontSize: 15,
    fontWeight: "600",
    flex: 2,
  },
  seasonEpCount: {
    color: "#9BA6CC",
    fontSize: 13,
    flex: 1,
    textAlign: "center",
  },
  seasonStatus: {
    flex: 1,
    alignItems: "flex-end",
  },
  seasonStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  requestBtn: {
    backgroundColor: "#5D7AF2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  requestBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
