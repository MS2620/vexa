import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { apiFetch } from "../api";
import { MediaCard } from "../components/MediaCard";

interface MediaListScreenProps {
  endpoint: string;
  title: string;
  onSelectMedia?: (id: number, type: string) => void;
}

export function MediaListScreen({
  endpoint,
  title,
  onSelectMedia,
}: MediaListScreenProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [endpoint]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await apiFetch(endpoint);
      if (data && data.results) {
        setData(data.results);
      } else {
        setData([]);
      }
    } catch (err: any) {
      setError(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString() + (item.media_type || "")}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            onPress={(i) => {
              if (onSelectMedia) {
                // If it doesn't have media_type (like /movies endpoint just returns them),
                // pass a fallback based on what we guess it is.
                onSelectMedia(
                  i.id,
                  i.media_type || (title === "Series" ? "tv" : "movie"),
                );
              } else {
                console.log("Selected", i.title || i.name);
              }
            }}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No results found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    color: "#F5F7FF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  row: {
    justifyContent: "space-between",
  },
  errorText: {
    color: "#ff4b4b",
    fontSize: 16,
  },
  emptyText: {
    color: "#9BA6CC",
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
});
