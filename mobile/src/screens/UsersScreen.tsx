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

export function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data } = await apiFetch("/api/users");
      if (data?.users) {
        setUsers(data.users);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to remove this user?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
              loadUsers();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not delete user");
            }
          },
        },
      ],
    );
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
        <Text style={styles.header}>User Management</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() =>
            Alert.alert(
              "Add User",
              "This feature is coming soon to the mobile app.",
            )
          }
        >
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={users}
        contentContainerStyle={styles.list}
        keyExtractor={(u) => String(u.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.roleText}>
                {item.role === "admin" ? "Administrator" : "Standard User"}
              </Text>
              {item.notify_email ? (
                <Text style={styles.emailText}>{item.notify_email}</Text>
              ) : null}
            </View>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id)}
            >
              <Feather name="trash-2" size={18} color="#ff4b4b" />
            </Pressable>
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
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#5D7AF2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    gap: 6,
  },
  addBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#141A32",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A335A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  username: {
    color: "#F6F8FF",
    fontSize: 16,
    fontWeight: "700",
  },
  roleText: {
    color: "#4ADE80",
    fontSize: 12,
    fontWeight: "600",
  },
  emailText: {
    color: "#9BA6CC",
    fontSize: 13,
  },
  deleteBtn: {
    padding: 8,
  },
});
