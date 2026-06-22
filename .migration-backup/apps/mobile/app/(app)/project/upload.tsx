import { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { colors } from "@/constants/colors";
import { useUploadQueueStore, type UploadQueueItem, type UploadItemStatus } from "@/store/uploadQueueStore";

const SUCCESS_GREEN = "#22c55e";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function calcEta(item: UploadQueueItem): string | null {
  if (item.status !== "uploading" || !item.uploadStartedAt || item.progress <= 0) return null;
  const elapsedMs = Date.now() - item.uploadStartedAt;
  if (elapsedMs <= 0) return null;
  const bytesUploaded = (item.progress / 100) * item.fileSize;
  const bytesPerMs = bytesUploaded / elapsedMs;
  if (bytesPerMs <= 0) return null;
  const remainingMs = (item.fileSize - bytesUploaded) / bytesPerMs;
  if (remainingMs < 5000) return "< 5 sec";
  if (remainingMs < 60000) return `~${Math.round(remainingMs / 1000)} sec`;
  return `~${Math.round(remainingMs / 60000)} min`;
}

function statusIcon(status: UploadItemStatus): string {
  switch (status) {
    case "local": return "📁";
    case "queued": return "⏳";
    case "uploading": return "⬆";
    case "uploaded": return "✅";
    case "error": return "❌";
  }
}

function statusLabel(status: UploadItemStatus): string {
  switch (status) {
    case "local": return "Waiting…";
    case "queued": return "In queue…";
    case "uploading": return "Uploading";
    case "uploaded": return "Uploaded";
    case "error": return "Failed";
  }
}

function FileRow({ item, onRetry }: { item: UploadQueueItem; onRetry: (uuid: string) => void }) {
  const eta = calcEta(item);
  const isActive = item.status === "uploading";
  const isError = item.status === "error";
  const isDone = item.status === "uploaded";
  return (
    <View style={styles.fileRow}>
      <Text style={styles.fileRowIcon}>{statusIcon(item.status)}</Text>
      <View style={styles.fileRowBody}>
        <Text style={styles.fileRowName} numberOfLines={1}>{item.fileName}</Text>
        <View style={styles.fileRowMetaRow}>
          <Text style={styles.metaGray}>{formatFileSize(item.fileSize)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={isDone ? styles.metaGreen : isError ? styles.metaRed : styles.metaGray}>{statusLabel(item.status)}</Text>
          {eta ? <><Text style={styles.metaDot}>·</Text><Text style={styles.metaGray}>{eta}</Text></> : null}
        </View>
        {(isActive || (item.progress > 0 && !isDone)) && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${item.progress}%` as `${number}%`, backgroundColor: isError ? colors.error : colors.brandIndigo }]} />
          </View>
        )}
        {isDone && <View style={[styles.progressTrack, { backgroundColor: SUCCESS_GREEN }]} />}
      </View>
      <View style={styles.fileRowRight}>
        {isActive && <Text style={styles.pctText}>{item.progress}%</Text>}
        {isError && <TouchableOpacity style={styles.retryBtn} onPress={() => onRetry(item.uuid)}><Text style={styles.retryBtnText}>Retry</Text></TouchableOpacity>}
        {isDone && <Text style={[styles.pctText, { color: SUCCESS_GREEN }]}>100%</Text>}
      </View>
    </View>
  );
}

export default function UploadProgressScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const projectId = parseInt(id ?? "0", 10);
  const projectName = name ?? "";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, retryItem, startUploadForProject } = useUploadQueueStore();

  useEffect(() => {
    const hasLocal = items.some((i) => i.projectId === projectId && i.status === "local");
    if (hasLocal) startUploadForProject(projectId);
  }, []);

  const [showSubmitted, setShowSubmitted] = useState(false);
  const [submittedShown, setSubmittedShown] = useState(false);

  const projectItems = items.filter((i) => i.projectId === projectId);
  const uploadedCount = projectItems.filter((i) => i.status === "uploaded").length;
  const allDone = projectItems.length > 0 && projectItems.every((i) => i.status === "uploaded");

  useEffect(() => {
    if (allDone && !submittedShown) { setSubmittedShown(true); setShowSubmitted(true); }
  }, [allDone]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: projectName, headerShown: true, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }} />
      {projectItems.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyIcon}>📭</Text><Text style={styles.emptyText}>No uploads for this project yet.</Text></View>
      ) : (
        <FlatList
          data={projectItems}
          keyExtractor={(i) => i.uuid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <FileRow item={item} onRetry={retryItem} />}
          ListHeaderComponent={<Text style={styles.listHeader}>{uploadedCount}/{projectItems.length} file{projectItems.length === 1 ? "" : "s"} uploaded</Text>}
        />
      )}
      <Modal visible={showSubmitted} transparent animationType="slide" onRequestClose={() => setShowSubmitted(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.modalEmoji}>✅</Text>
            <Text style={styles.modalTitle}>Safe To Close</Text>
            <Text style={styles.modalBody}>All {projectItems.length} file{projectItems.length === 1 ? " has" : "s have"} been uploaded successfully. You can safely close the app or navigate elsewhere.</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => { setShowSubmitted(false); router.push({ pathname: "/(app)/project/[id]", params: { id: String(projectId), name: projectName } }); }}>
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 10 },
  listHeader: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, fontWeight: "500" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
  fileRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  fileRowIcon: { fontSize: 22, marginTop: 1 },
  fileRowBody: { flex: 1, gap: 4 },
  fileRowName: { color: colors.text, fontWeight: "600", fontSize: 14 },
  fileRowMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  metaGreen: { color: SUCCESS_GREEN, fontSize: 12 },
  metaRed: { color: colors.error, fontSize: 12 },
  metaGray: { color: colors.textTertiary, fontSize: 12 },
  metaDot: { color: colors.textTertiary, fontSize: 12 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden", marginTop: 6 },
  progressFill: { height: "100%", borderRadius: 2 },
  fileRowRight: { alignItems: "flex-end", justifyContent: "center", minWidth: 58, gap: 6 },
  pctText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  retryBtn: { backgroundColor: colors.error, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, alignItems: "center", gap: 12 },
  modalEmoji: { fontSize: 56, marginBottom: 4 },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: "700" },
  modalBody: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 },
  modalBtn: { marginTop: 16, backgroundColor: colors.brandIndigo, borderRadius: 16, paddingVertical: 16, width: "100%", alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
});
