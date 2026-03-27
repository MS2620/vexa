import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { apiFetch } from "../api";

interface RequestsScreenProps {
  // Can be used to conditionally pass any other props
}

export function RequestsScreen({}: RequestsScreenProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
    loadRequests();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data } = await apiFetch("/api/auth/me");
      setIsAdmin(data?.role === "admin");
    } catch {}
  };

  const loadRequests = async () => {
    setError("");
    try {
      // Fetch both pending and general requests.
      // Or just standard dashboard requests first to simplify
      const { data } = await apiFetch("/api/dashboard/requests");
      if (data?.results) {
        setRequests(data.results);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleApprove = async (id: number) => {
    try {
      await apiFetch(`/api/request/${id}/approve`, { method: "POST" });
      Alert.alert("Success", "Request approved!");
      onRefresh();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to approve request");
    }
  };

  const statusColor = (status: string) => {
    if (status === "Available") return "#4ADE80";
    if (status === "Pending Approval") return "#FBBF24";
    if (status === "Processing") return "#60A5FA";
    if (status === "Denied") return "#F87171";
    return "#A8B3D6";
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
      <Text style={styles.header}>Requests</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={requests}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#5D7AF2"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No requests found.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: statusColor(item.status) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: statusColor(item.status) },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={styles.metaText}>
              Requested by {item.requested_by || "Unknown"} •
              {item.media_type === "tv"
                ? ` TV (${item.seasons ? `S${item.seasons.join(", S")}` : "All"})`
                : " Movie"}
            </Text>

            {isAdmin && item.status === "Pending Approval" && (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.approveBtn}
                  onPress={() => handleApprove(item.id)}
                >
                  <Text style={styles.approveText}>Approve</Text>
                </Pressable>
                {/* Deny isn't fully scaffolded in the provided API so we omit or mock */}
              </View>
            )}
          </View>
        )}
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
  card: {
    backgroundColor: "#141A32",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A335A",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "#F6F8FF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaText: {
    color: "#9BA6CC",
    fontSize: 13,
  },
  emptyText: {
    color: "#8088A7",
    textAlign: "center",
    marginTop: 40,
  },
  errorText: {
    color: "#F87171",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  approveBtn: {
    backgroundColor: "#4ADE8020",
    borderWidth: 1,
    borderColor: "#4ADE80",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveText: {
    color: "#4ADE80",
    fontWeight: "600",
    fontSize: 13,
  },
});
