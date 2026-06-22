import { useState, useEffect, Platform } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { colors } from "@/constants/colors";
import { useUploadQueueStore } from "@/store/uploadQueueStore";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
  const s = (totalSecs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ReviewScreen() {
  const { id, name, localUri, fileName, contentType, fileSize, durationMs } = useLocalSearchParams<{
    id: string; name: string; localUri: string; fileName: string; contentType: string; fileSize: string; durationMs?: string;
  }>();
  const projectId = parseInt(id ?? "0", 10);
  const projectName = name ?? "";
  const fileSizeNum = parseInt(fileSize ?? "0", 10);
  const durationMsNum = durationMs ? parseInt(durationMs, 10) : undefined;

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addItem } = useUploadQueueStore();

  const isVideo = contentType?.startsWith("video/");
  const isPhoto = contentType?.startsWith("image/");
  const isAudio = contentType?.startsWith("audio/");

  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<{ playAsync: () => Promise<void>; pauseAsync: () => Promise<void>; unloadAsync: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!isAudio || Platform.OS === "web") return;
    let loadedSound: typeof sound = null;
    (async () => {
      try {
        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: localUri ?? "" },
          { shouldPlay: false },
          (status) => { if ((status as { isLoaded?: boolean; didJustFinish?: boolean }).isLoaded && (status as { didJustFinish?: boolean }).didJustFinish) setIsPlaying(false); },
        );
        loadedSound = s as typeof sound;
        setSound(s as typeof sound);
      } catch {}
    })();
    return () => { loadedSound?.unloadAsync().catch(() => {}); };
  }, []);

  async function toggleAudio() {
    if (!sound) return;
    if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
    else { await sound.playAsync(); setIsPlaying(true); }
  }

  function handleKeep() {
    addItem({ projectId, projectName, localUri: localUri ?? "", fileName: fileName ?? "", contentType: contentType ?? "", fileSize: fileSizeNum });
    router.push({ pathname: "/(app)/project/[id]", params: { id: String(projectId), name: projectName } });
  }

  async function handleRetake() {
    if (Platform.OS !== "web") {
      try { const fs = await import("expo-file-system"); await fs.deleteAsync(localUri ?? "", { idempotent: true }); } catch {}
    }
    router.replace({ pathname: "/(app)/project/record", params: { id: String(projectId), name: projectName } });
  }

  async function handleDelete() {
    if (Platform.OS !== "web") {
      try { const fs = await import("expo-file-system"); await fs.deleteAsync(localUri ?? "", { idempotent: true }); } catch {}
    }
    router.push({ pathname: "/(app)/project/[id]", params: { id: String(projectId), name: projectName } });
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Review Clip", headerShown: true, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }} />
      <View style={styles.preview}>
        {isVideo && Platform.OS !== "web" && (() => {
          const { Video, ResizeMode } = require("expo-av");
          return <Video source={{ uri: localUri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.CONTAIN} useNativeControls shouldPlay />;
        })()}
        {isPhoto && <Image source={{ uri: localUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
        {isAudio && (
          <View style={styles.audioPreview}>
            <Text style={styles.audioIcon}>🎙</Text>
            <Text style={styles.audioFileName} numberOfLines={2}>{fileName}</Text>
            {durationMsNum ? <Text style={styles.audioDuration}>{formatDuration(durationMsNum)}</Text> : null}
            <TouchableOpacity style={styles.audioPlayBtn} onPress={() => void toggleAudio()}>
              <Text style={styles.audioPlayBtnText}>{isPlaying ? "⏸  Pause" : "▶  Play"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          <Text style={styles.fileMeta}>{formatFileSize(fileSizeNum)}{durationMsNum ? `  ·  ${formatDuration(durationMsNum)}` : ""}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.retakeBtn} onPress={() => void handleRetake()}><Text style={styles.retakeBtnText}>↺  Retake</Text></TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => void handleDelete()}><Text style={styles.deleteBtnIcon}>🗑</Text></TouchableOpacity>
          <TouchableOpacity style={styles.keepBtn} onPress={handleKeep}><Text style={styles.keepBtnText}>✓  Keep</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  preview: { flex: 1 },
  audioPreview: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
  audioIcon: { fontSize: 64, marginBottom: 4 },
  audioFileName: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  audioDuration: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  audioPlayBtn: { marginTop: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 28, paddingHorizontal: 32, paddingVertical: 14 },
  audioPlayBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  footer: { backgroundColor: colors.surface, paddingTop: 16, paddingHorizontal: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.border },
  fileInfo: { gap: 3 },
  fileName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  fileMeta: { color: colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: "row", gap: 10, alignItems: "center" },
  retakeBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, alignItems: "center" },
  retakeBtnText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  deleteBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,59,48,0.12)", alignItems: "center", justifyContent: "center" },
  deleteBtnIcon: { fontSize: 20 },
  keepBtn: { flex: 1, borderRadius: 14, backgroundColor: colors.brandIndigo, paddingVertical: 14, alignItems: "center" },
  keepBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
