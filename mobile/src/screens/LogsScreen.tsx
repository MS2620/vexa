import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { apiFetch } from "../api";
import { Feather } from "@expo/vector-icons";

export function LogsScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data } = await apiFetch("/api/logs");
      if (data?.logs) {
        setLogs(data.logs);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    Alert.alert("Clear Logs", "Are you sure you want to delete all logs?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/logs`, { method: "DELETE" });
            loadLogs();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Could not clear logs");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5D7AF2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>System Logs</Text>
        <Pressable style={styles.clearBtn} onPress={handleClearLogs}>
          <Feather name="trash" size={16} color="#FFF" />
          <Text style={styles.clearBtnText}>Clear All</Text>
        </Pressable>
      </View>

      <FlatList
        data={logs}
        contentContainerStyle={styles.list}
        keyExtractor={(l, i) => String(l.id || i)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.logHeader}>
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      item.level === "error"
                        ? "#ff4b4b20"
                        : item.level === "warn"
                          ? "#facc1520"
                          : "#5D7AF220",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color:
                        item.level === "error"
                          ? "#ff4b4b"
                          : item.level === "warn"
                            ? "#facc15"
                            : "#5D7AF2",
                    },
                  ]}
                >
                  {item.level?.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.message}>{item.message}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No logs found.</Text>
          </View>
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
    paddingTop: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  header: {
    color: "#F5F7FF",
    fontSize: 22,
    fontWeight: "700",
  },
  clearBtn: {
    flexDirection: "row",
    backgroundColor: "#F87171",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    gap: 6,
  },
  clearBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#141A32",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2A335A",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  timestamp: {
    color: "#8088A7",
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  message: {
    color: "#E5EAFE",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: "#8088A7",
    fontSize: 14,
  },
});
