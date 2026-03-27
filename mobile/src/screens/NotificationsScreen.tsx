import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../api";

export function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data } = await apiFetch("/api/notifications");
      if (data?.results) {
        setNotifications(data.results);
      }
    } catch (err) {
      console.warn("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      });
      // Update locally
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch (err) {
      console.warn("Could not mark as read", err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "request":
        return { name: "inbox" as any, color: "#FBBF24" }; // Yellow
      case "automation":
        return { name: "zap" as any, color: "#4ADE80" }; // Green
      default:
        return { name: "info" as any, color: "#9BA6CC" }; // Blue/Gray
    }
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
      {notifications.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bell-off" size={48} color="#2A335A" />
          <Text style={styles.emptyText}>No notifications here!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const icon = getIconForType(item.type);
            return (
              <Pressable
                onPress={() => markAsRead(item.id)}
                style={[
                  styles.notificationItem,
                  !item.is_read && styles.notificationUnread,
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: icon.color + "20" },
                  ]}
                >
                  <Feather name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={styles.contentBox}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                  ) : null}
                  <Text style={styles.timeText}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
              </Pressable>
            );
          }}
        />
      )}
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
  },
  emptyText: {
    color: "#9BA6CC",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141A32",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A335A",
  },
  notificationUnread: {
    borderColor: "#5D7AF2",
    backgroundColor: "#161A2B",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  contentBox: {
    flex: 1,
  },
  title: {
    color: "#F6F8FF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#9BA6CC",
    fontSize: 13,
    marginBottom: 6,
  },
  timeText: {
    color: "#4A5578",
    fontSize: 11,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5D7AF2",
    marginLeft: 12,
  },
});
