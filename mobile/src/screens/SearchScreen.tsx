import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../api";
import { MediaCard } from "../components/MediaCard";

type SearchScreenProps = {
  onSelectMedia?: (id: number, type: string) => void;
};

type SearchResultItem = {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
};

export function SearchScreen({ onSelectMedia }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const { data } = await apiFetch(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
      );
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch (err: any) {
      setError(err?.message || "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Search</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies and series"
          placeholderTextColor="#8088A7"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={runSearch}
          autoCapitalize="none"
        />
        <Pressable style={styles.searchBtn} onPress={runSearch}>
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Feather name="search" size={18} color="#FFF" />
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(item) => `${item.media_type || "unknown"}-${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            onPress={(selected) => {
              if (onSelectMedia) {
                onSelectMedia(
                  selected.id,
                  selected.media_type || (selected.title ? "movie" : "tv"),
                );
              }
            }}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {hasSearched
                ? "No results found."
                : "Search for a movie or TV series."}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    color: "#F5F7FF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#161A2B",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A335A",
    color: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#5D7AF2",
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    justifyContent: "space-between",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyText: {
    color: "#9BA6CC",
    fontSize: 15,
    textAlign: "center",
    marginTop: 24,
  },
  errorText: {
    color: "#FF7373",
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
