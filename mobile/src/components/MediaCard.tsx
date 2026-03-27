import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  media_type?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

interface MediaCardProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
}

export function MediaCard({ item, onPress }: MediaCardProps) {
  const displayTitle = item.title || item.name || "Unknown";
  const displayDate = item.release_date || item.first_air_date;
  const year = displayDate ? displayDate.substring(0, 4) : "";
  const imageUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Image";

  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
      <Image source={{ uri: imageUrl }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {displayTitle}
        </Text>
        <View style={styles.metaRow}>
          {year ? <Text style={styles.metaText}>{year}</Text> : null}
          {item.vote_average ? (
            <Text style={styles.metaText}>
              ⭐ {item.vote_average.toFixed(1)}
            </Text>
          ) : null}
          {item.media_type ? (
            <Text style={styles.metaTextType}>
              {item.media_type.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    marginBottom: 16,
    backgroundColor: "#141A32",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A335A",
  },
  image: {
    width: "100%",
    aspectRatio: 2 / 3,
    backgroundColor: "#0D1223",
  },
  info: {
    padding: 8,
  },
  title: {
    color: "#F6F8FF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    color: "#9BA6CC",
    fontSize: 12,
  },
  metaTextType: {
    color: "#5D7AF2",
    fontSize: 10,
    fontWeight: "700",
  },
});
