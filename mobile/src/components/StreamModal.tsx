import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiFetch } from "../api";

interface StreamData {
  name: string;
  title: string;
  infoHash: string;
}

interface StreamModalProps {
  visible: boolean;
  onClose: () => void;
  tmdbId: number;
  type: string; // 'movie' or 'tv'
  season?: number;
  episode?: number;
}

export function StreamModal({
  visible,
  onClose,
  tmdbId,
  type,
  season,
  episode,
}: StreamModalProps) {
  const [loading, setLoading] = useState(false);
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [downloadingHash, setDownloadingHash] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchStreams();
    } else {
      setStreams([]);
      setDownloadingHash(null);
    }
  }, [visible, tmdbId, type, season, episode]);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      let url = `/api/streams?tmdbId=${tmdbId}&type=${type}`;
      if (season) url += `&s=${season}`;
      // In this basic version we will just fetch the whole season or movie
      // if (episode) url += `&e=${episode}`;

      const res = await apiFetch(url);
      if (res.data && res.data.streams) {
        setStreams(res.data.streams);
      } else {
        setStreams([]);
      }
    } catch (err: any) {
      console.warn("Failed to fetch streams", err);
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (infoHash: string, streamTitle: string) => {
    setDownloadingHash(infoHash);
    try {
      await apiFetch("/api/request", {
        method: "POST",
        body: JSON.stringify({
          infoHash,
          title: streamTitle,
          type,
          tmdbId,
          seasonNumber: season,
        }),
      });
      Alert.alert(
        "Request Sent",
        "The stream request has been submitted successfully.",
        [{ text: "OK", onPress: onClose }],
      );
    } catch (err: any) {
      Alert.alert("Request Failed", err.message || "Something went wrong.");
    } finally {
      setDownloadingHash(null);
    }
  };

  const getResolution = (s: StreamData) => {
    const title = (s.name + " " + s.title).toLowerCase();
    if (title.includes("2160") || title.includes("4k")) return "4K";
    if (title.includes("1080")) return "1080p";
    if (title.includes("720")) return "720p";
    return "SD";
  };

  const renderStream = ({ item }: { item: StreamData }) => {
    const res = getResolution(item);
    return (
      <View style={styles.streamItem}>
        <View style={styles.streamHeader}>
          <Text style={styles.streamName}>{item.name}</Text>
          <View style={styles.resBadge}>
            <Text style={styles.resText}>{res}</Text>
          </View>
        </View>
        <Text style={styles.streamTitle}>{item.title}</Text>
        <Pressable
          style={[
            styles.downloadBtn,
            downloadingHash === item.infoHash && styles.downloadBtnDisabled,
          ]}
          onPress={() => handleDownload(item.infoHash, item.title)}
          disabled={downloadingHash === item.infoHash}
        >
          {downloadingHash === item.infoHash ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather name="download" size={14} color="#FFF" />
              <Text style={styles.downloadText}>Download</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Available Streams</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#9BA6CC" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#5D7AF2" />
              <Text style={styles.loadingText}>Searching sources...</Text>
            </View>
          ) : streams.length === 0 ? (
            <View style={styles.center}>
              <Feather name="shield-off" size={48} color="#2A335A" />
              <Text style={styles.errorText}>No streams found.</Text>
            </View>
          ) : (
            <FlatList
              data={streams}
              keyExtractor={(item, idx) => item.infoHash || String(idx)}
              renderItem={renderStream}
              contentContainerStyle={{ padding: 16 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(13, 18, 35, 0.9)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#161A2B",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: "80%",
    borderWidth: 1,
    borderColor: "#2B355D",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2B355D",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9BA6CC",
    marginTop: 12,
    fontSize: 15,
  },
  errorText: {
    color: "#9BA6CC",
    marginTop: 12,
    fontSize: 15,
  },
  streamItem: {
    backgroundColor: "#141824",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2B355D",
  },
  streamHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  streamName: {
    color: "#5D7AF2",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(93, 122, 242, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resBadge: {
    borderWidth: 1,
    borderColor: "#9BA6CC",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resText: {
    color: "#9BA6CC",
    fontSize: 10,
    fontWeight: "800",
  },
  streamTitle: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5D7AF2",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  downloadBtnDisabled: {
    opacity: 0.5,
  },
  downloadText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
