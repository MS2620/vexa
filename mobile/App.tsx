import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { MediaListScreen } from "./src/screens/MediaListScreen";
import { MediaDetailsScreen } from "./src/screens/MediaDetailsScreen";
import { RequestsScreen } from "./src/screens/RequestsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { UsersScreen } from "./src/screens/UsersScreen";
import { LogsScreen } from "./src/screens/LogsScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }) as any,
});

const API_BASE_URL =
  Platform.OS === "web"
    ? ""
    : process.env.EXPO_PUBLIC_API_URL || "https://localhost:3000";

type TabKey =
  | "discover"
  | "movies"
  | "series"
  | "calendar"
  | "requests"
  | "search"
  | "users"
  | "logs"
  | "blocklist"
  | "settings"
  | "notifications";

type TabConfig = {
  key: TabKey;
  title: string;
  subtitle: string;
  routeHint: string;
};

const TABS: TabConfig[] = [
  {
    key: "discover",
    title: "Discover",
    subtitle: "Trending and upcoming media from your dashboard",
    routeHint: "/api/dashboard/trending",
  },
  {
    key: "movies",
    title: "Movies",
    subtitle: "Movie library and on-demand discovery",
    routeHint: "/api/movies",
  },
  {
    key: "series",
    title: "Series",
    subtitle: "Series library and episode progress",
    routeHint: "/api/series",
  },
  {
    key: "calendar",
    title: "Calendar",
    subtitle: "Upcoming episodes and release timelines",
    routeHint: "/api/dashboard/upcoming-episodes",
  },
  {
    key: "requests",
    title: "Requests",
    subtitle: "Track and approve media requests",
    routeHint: "/api/dashboard/requests",
  },
  {
    key: "search",
    title: "Search",
    subtitle: "Search movies, series, and metadata",
    routeHint: "/api/search?q=<query>",
  },
  {
    key: "users",
    title: "Users",
    subtitle: "Manage user access and permissions",
    routeHint: "/api/users",
  },
  {
    key: "logs",
    title: "Logs",
    subtitle: "Inspect service and sync logs",
    routeHint: "/api/logs",
  },
  {
    key: "blocklist",
    title: "Blocklist",
    subtitle: "Configure blocked matches and filters",
    routeHint: "/api/blocklist",
  },
  {
    key: "settings",
    title: "Settings",
    subtitle: "Configure integrations and notifications",
    routeHint: "/api/settings",
  },
  {
    key: "notifications",
    title: "Notifications",
    subtitle: "View your alerts and requests status",
    routeHint: "/api/notifications",
  },
];

export type SelectedMediaState = { id: number; type: string } | null;

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState("");
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [username, setUsername] = useState("admin"); // Fallback test
  const [password, setPassword] = useState("admin");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("discover");
  const [searchText, setSearchText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaState>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const activeConfig = useMemo(
    () => TABS.find((tab) => tab.key === activeTab) ?? TABS[0],
    [activeTab],
  );

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAuthenticated) {
      fetchUnreadNotifications();
      interval = setInterval(fetchUnreadNotifications, 30000); // Check every 30s
    }
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const fetchUnreadNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data?.unreadCount !== undefined) {
        setUnreadNotifications(data.unreadCount);
      }
    } catch (e) {
      console.warn("Failed to fetch unread notifications");
    }
  };

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notif) => {
        setNotification(notif);
        fetchUnreadNotifications(); // Refresh count on new push
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log(response);
        setActiveTab("notifications"); // Auto-open tab if tapped
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const checkSession = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) setIsAuthenticated(true);
      else setIsAuthenticated(false);
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.warn("Session check failed:", e.message);
      setIsAuthenticated(false);
      // If it's a TypeError or AbortError, it might be an SSL/CORS issue
      if (e.name === "AbortError" || e.message.includes("Failed to fetch")) {
        Alert.alert(
          "SSL / Network Error",
          "Could not connect to the Next.js server. If using HTTPS, ensure you have trusted the self-signed certificate by visiting the API URL directly in your browser.",
        );
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.warn("Failed to get push token for push notification!");
        return;
      }
      try {
        const projectId = "d87080a9-XXXX-XXXX-XXXX-XXXXXXXXXXXX"; // Usually dynamically injected if hooked via EAS, but passing empty string fallback
        token = (
          await Notifications.getExpoPushTokenAsync({ projectId: "vexa-app" })
        ).data;
      } catch (e) {
        console.warn("Expo token error", e);
      }
    } else {
      // console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setIsAuthenticated(true);
      } else {
        Alert.alert("Login Failed", data?.error || "Invalid credentials");
      }
    } catch (error: any) {
      Alert.alert(
        "Network Error",
        error.message || "Could not connect to backend",
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
  };

  if (isLoadingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5D7AF2" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={[styles.container, { justifyContent: "center" }]}>
          <Text
            style={[styles.brand, { textAlign: "center", marginBottom: 20 }]}
          >
            Vexa
          </Text>
          <View style={styles.card}>
            <TextInput
              style={styles.inputBox}
              placeholder="Username"
              placeholderTextColor="#8088A7"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.inputBox}
              placeholder="Password"
              placeholderTextColor="#8088A7"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Pressable
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </Pressable>
            <Text style={[styles.note, { textAlign: "center", marginTop: 10 }]}>
              URL: {API_BASE_URL}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* HEADER */}
      <View style={styles.topBar}>
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>V</Text>
          </View>
          <Text style={styles.brandTitle}>Vexa</Text>
        </View>
        <View style={styles.topRightIcons}>
          <Pressable style={styles.iconBtn}>
            <Feather name="search" size={20} color="#9BA6CC" />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setActiveTab("notifications")}
          >
            <View>
              <Feather
                name="bell"
                size={20}
                color={activeTab === "notifications" ? "#FFF" : "#9BA6CC"}
              />
              {unreadNotifications > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setActiveTab("settings")}
          >
            <Feather name="menu" size={20} color="#9BA6CC" />
          </Pressable>
        </View>
      </View>

      {/* ADMIN TOP TABS (Only visible in Settings, Users, Logs) */}
      {["settings", "users", "logs", "blocklist"].includes(activeTab) && (
        <View style={styles.adminMenuBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.adminMenuContent}
          >
            {[
              { key: "settings", label: "Settings", icon: "settings" },
              { key: "users", label: "Users", icon: "users" },
              { key: "logs", label: "Logs", icon: "terminal" },
              { key: "blocklist", label: "Blocklist", icon: "shield" },
            ].map((sm) => {
              const secActive = activeTab === sm.key;
              return (
                <Pressable
                  key={sm.key}
                  style={[
                    styles.adminMenuBtn,
                    secActive && styles.adminMenuBtnActive,
                  ]}
                  onPress={() => setActiveTab(sm.key as TabKey)}
                >
                  <Feather
                    name={sm.icon as any}
                    size={14}
                    color={secActive ? "#FFF" : "#8088A7"}
                  />
                  <Text
                    style={[
                      styles.adminMenuText,
                      secActive && styles.adminMenuTextActive,
                    ]}
                  >
                    {sm.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.adminMenuBtn, { marginLeft: 10 }]}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={14} color="#ff4b4b" />
              <Text style={[styles.adminMenuText, { color: "#ff4b4b" }]}>
                Logout
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* MAIN CONTENT AREA */}
      <View style={styles.contentArea}>
        {selectedMedia ? (
          <MediaDetailsScreen
            id={selectedMedia.id}
            type={selectedMedia.type}
            onBack={() => setSelectedMedia(null)}
          />
        ) : ["discover", "movies", "series"].includes(activeTab) ? (
          <MediaListScreen
            endpoint={activeConfig.routeHint}
            title={activeConfig.title}
            onSelectMedia={(id, type) => setSelectedMedia({ id, type })}
          />
        ) : activeTab === "requests" ? (
          <RequestsScreen />
        ) : activeTab === "settings" ? (
          <SettingsScreen />
        ) : activeTab === "users" ? (
          <UsersScreen />
        ) : activeTab === "logs" ? (
          <LogsScreen />
        ) : activeTab === "notifications" ? (
          <NotificationsScreen />
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{activeConfig.title}</Text>
              <Text style={styles.cardSubtitle}>{activeConfig.subtitle}</Text>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>API route</Text>
                <Text style={styles.metaValue}>{activeConfig.routeHint}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.metaLabel}>Backend URL</Text>
                <Text style={styles.metaValue}>{API_BASE_URL}</Text>
              </View>
              <Text style={styles.note}>
                Placeholder for {activeConfig.title}. This screen is not yet
                fully migrated.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        {[
          { key: "discover", icon: "compass", label: "Discover" },
          { key: "movies", icon: "film", label: "Movies" },
          { key: "series", icon: "tv", label: "Series" },
          { key: "calendar", icon: "calendar", label: "Calendar" },
          { key: "requests", icon: "clock", label: "Requests" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.navItem}
              onPress={() => {
                setActiveTab(tab.key as TabKey);
                setSelectedMedia(null);
              }}
            >
              <View
                style={[styles.navIconWrap, isActive && styles.navIconActive]}
              >
                {isActive && activeTab === "discover" ? (
                  <View style={styles.discoverOrb}>
                    <Text style={styles.discoverOrbText}>N</Text>
                  </View>
                ) : (
                  <Feather
                    name={tab.icon as any}
                    size={22}
                    color={isActive ? "#5D7AF2" : "#8088A7"}
                  />
                )}
              </View>
              <Text
                style={[styles.navLabel, isActive && styles.navLabelActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#0C0E17",
    justifyContent: "center",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0C0E17",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  placeholderContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0C0E17",
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 28,
    height: 28,
    backgroundColor: "#5D7AF2",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  logoIconText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 16,
  },
  brandTitle: {
    color: "#F6F8FF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  topRightIcons: {
    flexDirection: "row",
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#161A2B",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444", // Red
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#090D1A",
  },
  badgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "bold",
  },
  adminMenuBar: {
    height: 48,
    backgroundColor: "#0C0E17",
    borderBottomWidth: 1,
    borderBottomColor: "#1A2035",
  },
  adminMenuContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  adminMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#161A2B",
  },
  adminMenuBtnActive: {
    backgroundColor: "#263E9A",
  },
  adminMenuText: {
    color: "#8088A7",
    fontSize: 13,
    fontWeight: "600",
  },
  adminMenuTextActive: {
    color: "#FFF",
  },
  contentArea: {
    flex: 1,
    backgroundColor: "#0C0E17",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#0C0E17",
    borderTopWidth: 1,
    borderTopColor: "#1A2035",
    paddingBottom: 24, // Assuming some safe area padding for modern phones
    paddingTop: 8,
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flex: 1,
  },
  navIconWrap: {
    width: 48,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  navIconActive: {
    // Optionally background here if needed
  },
  discoverOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1B2244",
    borderWidth: 1,
    borderColor: "#5D7AF2",
    justifyContent: "center",
    alignItems: "center",
  },
  discoverOrbText: {
    color: "#5D7AF2",
    fontWeight: "700",
    fontSize: 14,
  },
  navLabel: {
    color: "#8088A7",
    fontSize: 11,
    fontWeight: "500",
  },
  navLabelActive: {
    color: "#5D7AF2",
    fontWeight: "600",
  },
  // Remaining shared styles...
  inputBox: {
    backgroundColor: "#161A2B",
    color: "#FFF",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: "#5D7AF2",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  brand: {
    color: "#F6F8FF",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2540",
    backgroundColor: "#121626",
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: "#F5F7FF",
    fontSize: 22,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#AEB8DA",
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    gap: 4,
  },
  metaLabel: {
    color: "#7E8BB8",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaValue: {
    color: "#E5EAFE",
    fontSize: 14,
    fontWeight: "600",
  },
  note: {
    marginTop: 4,
    color: "#B7C0E3",
    fontSize: 13,
    lineHeight: 19,
  },
});
