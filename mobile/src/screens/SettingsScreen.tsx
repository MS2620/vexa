import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { apiFetch } from "../api";

export function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Forms states
  const [tmdbKey, setTmdbKey] = useState("");
  const [rdToken, setRdToken] = useState("");
  const [plexUrl, setPlexUrl] = useState("");
  const [plexToken, setPlexToken] = useState("");
  const [plexMovieId, setPlexMovieId] = useState("");
  const [plexTvId, setPlexTvId] = useState("");
  const [prefRes, setPrefRes] = useState("");
  const [prefLang, setPrefLang] = useState("");
  const [vapidSubject, setVapidSubject] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await apiFetch("/api/settings");
      if (data) {
        setTmdbKey(data.tmdb_key || "");
        setRdToken(data.rd_token || "");
        setPlexUrl(data.plex_url || "");
        setPlexToken(data.plex_token || "");
        setPlexMovieId(data.plex_lib_id ? String(data.plex_lib_id) : "");
        setPlexTvId(data.plex_tv_lib_id ? String(data.plex_tv_lib_id) : "");
        setPrefRes(data.preferred_resolution || "");
        setPrefLang(data.preferred_language || "");
        setVapidSubject(data.vapid_subject || "");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          tmdb_key: tmdbKey,
          rd_token: rdToken,
          plex_url: plexUrl,
          plex_token: plexToken,
          plex_lib_id: plexMovieId ? parseInt(plexMovieId) : null,
          plex_tv_lib_id: plexTvId ? parseInt(plexTvId) : null,
          preferred_resolution: prefRes,
          preferred_language: prefLang,
          vapid_subject: vapidSubject,
        }),
      });
      Alert.alert("Success", "Settings saved successfully");
    } catch (err: any) {
      Alert.alert("Save Failed", err.message || "Could not save settings");
    } finally {
      setSaving(false);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Main Integrations</Text>

        <Text style={styles.label}>TMDB API Key</Text>
        <TextInput
          style={styles.input}
          placeholder="Required for fetching poster metadata"
          placeholderTextColor="#8088A7"
          value={tmdbKey}
          onChangeText={setTmdbKey}
        />

        <Text style={styles.label}>Real-Debrid API Token</Text>
        <TextInput
          style={styles.input}
          placeholder="Debrid token for accessing torrents"
          placeholderTextColor="#8088A7"
          value={rdToken}
          onChangeText={setRdToken}
          secureTextEntry
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plex Settings</Text>

        <Text style={styles.label}>Plex URL</Text>
        <TextInput
          style={styles.input}
          placeholder="http://192.168.1.50:32400"
          placeholderTextColor="#8088A7"
          value={plexUrl}
          onChangeText={setPlexUrl}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Plex Token</Text>
        <TextInput
          style={styles.input}
          placeholder="Plex access token"
          placeholderTextColor="#8088A7"
          value={plexToken}
          onChangeText={setPlexToken}
          secureTextEntry
        />

        <Text style={styles.label}>Plex Movie Library ID</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1"
          placeholderTextColor="#8088A7"
          value={plexMovieId}
          onChangeText={setPlexMovieId}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Plex TV Library ID</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2"
          placeholderTextColor="#8088A7"
          value={plexTvId}
          onChangeText={setPlexTvId}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>STREAM PREFERENCES</Text>

        <Text style={styles.label}>Preferred Resolution</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={prefRes || "1080p"}
            onValueChange={(val) => setPrefRes(val)}
            style={styles.picker}
            dropdownIconColor="#FFF"
          >
            <Picker.Item label="1080p" value="1080p" />
            <Picker.Item label="2160p (4K)" value="2160p" />
            <Picker.Item label="720p" value="720p" />
          </Picker>
        </View>

        <Text style={styles.label}>Preferred Language</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={prefLang || "English"}
            onValueChange={(val) => setPrefLang(val)}
            style={styles.picker}
            dropdownIconColor="#FFF"
          >
            <Picker.Item label="English" value="English" />
            <Picker.Item label="Spanish" value="Spanish" />
            <Picker.Item label="French" value="French" />
            <Picker.Item label="German" value="German" />
            <Picker.Item label="Italian" value="Italian" />
            <Picker.Item label="Japanese" value="Japanese" />
            <Picker.Item label="Korean" value="Korean" />
          </Picker>
        </View>

        <Text style={styles.label}>VAPID Subject (Push)</Text>
        <TextInput
          style={styles.input}
          placeholder="mailto:admin@example.com"
          placeholderTextColor="#8088A7"
          value={vapidSubject}
          onChangeText={setVapidSubject}
          autoCapitalize="none"
        />
      </View>

      <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.saveBtnText}>Save Settings</Text>
        )}
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    color: "#F5F7FF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#141A32",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A335A",
  },
  sectionTitle: {
    color: "#E5EAFE",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  label: {
    color: "#9BA6CC",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1C2442",
    color: "#FFF",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2B355D",
  },
  pickerContainer: {
    backgroundColor: "#161A2B",
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2B355D",
    overflow: "hidden",
    height: 48,
    justifyContent: "center",
  },
  picker: {
    color: "#FFF",
    backgroundColor: "#1C2442",
    borderWidth: 0,
    outlineStyle: "none",
    height: "100%",
    paddingHorizontal: 12,
  } as any,
  saveBtn: {
    backgroundColor: "#5D7AF2",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
