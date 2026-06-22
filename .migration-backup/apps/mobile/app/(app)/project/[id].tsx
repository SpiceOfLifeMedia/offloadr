import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { offloadrApi, type StudentProjectDetail, type StudentFile } from "@/api/client";
import { FileCard } from "@/components/FileCard";
import { colors } from "@/constants/colors";
import { useUploadQueueStore } from "@/store/uploadQueueStore";

export default function ProjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const projectId = parseInt(id ?? "0", 10);
  const projectName = name ?? "";

  const [detail, setDetail] = useState<StudentProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items: queueItems, startUploadForProject } = useUploadQueueStore();
  const pendingItems = queueItems.filter((i) => i.projectId === projectId && i.status !== "uploaded");
  const localItems = pendingItems.filter((i) => i.status === "local");
  const activeItems = pendingItems.filter((i) => i.status === "queued" || i.status === "uploading");

  const load = useCallback(async () => {
    const res = await offloadrApi.student.projects.get(projectId);
    if (res.ok && res.data?.detail) { setDetail(res.data.detail); setError(null); }
    else setError(res.message ?? "Failed to load project.");
  }, [projectId]);

  useEffect(() => { setLoading(true); void load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  function uploadBtnLabel(): string {
    if (activeItems.length > 0) return "View Uploads";
    if (localItems.length === 1) return "Upload 1 File";
    return `Upload ${localItems.length} Files`;
  }

  function handleUploadPress() {
    if (localItems.length > 0) startUploadForProject(projectId);
    router.push({ pathname: "/(app)/project/upload", params: { id: String(projectId), name: projectName } });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandIndigo} /></View>;
  if (error || !detail) return <View style={styles.center}><Text style={styles.errorText}>{error ?? "Project not found."}</Text></View>;

  const { draftFiles, submittedFiles, locked } = detail;
  const serverFileCount = draftFiles.length + submittedFiles.length;

  return (
    <>
      <Stack.Screen options={{ title: projectName, headerShown: true, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }} />
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} tintColor={colors.brandIndigo} />}
      >
        {locked ? <View style={styles.lockedBanner}><Text style={styles.lockedText}>🔒 This project has been delivered.</Text></View> : null}
        <View style={styles.meta}><Text style={styles.metaText}>{serverFileCount === 0 ? "No files uploaded yet." : `${serverFileCount} file${serverFileCount === 1 ? "" : "s"} on server`}</Text></View>

        {draftFiles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Draft</Text>
            {(draftFiles as StudentFile[]).map((f) => <FileCard key={f.id} fileName={f.originalFileName} fileSize={f.fileSize} status="draft" uploadedAt={f.uploadedAt} />)}
          </View>
        )}
        {submittedFiles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Delivered</Text>
            {(submittedFiles as StudentFile[]).map((f) => <FileCard key={f.id} fileName={f.originalFileName} fileSize={f.fileSize} status="submitted" uploadedAt={f.submittedAt} />)}
          </View>
        )}

        {pendingItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Pending Upload</Text>
            {pendingItems.map((item) => (
              <View key={item.uuid} style={styles.queueItem}>
                <Text style={styles.queueItemIcon}>{item.status === "uploading" ? "⬆" : item.status === "error" ? "❌" : "📁"}</Text>
                <View style={styles.queueItemBody}>
                  <Text style={styles.queueItemName} numberOfLines={1}>{item.fileName}</Text>
                  {item.status === "uploading" && <View style={styles.miniProgressTrack}><View style={[styles.miniProgressFill, { width: `${item.progress}%` as `${number}%` }]} /></View>}
                  {item.status === "error" && item.error ? <Text style={styles.queueItemError} numberOfLines={1}>{item.error}</Text> : null}
                </View>
                {item.status === "uploading" && <Text style={styles.queueItemPct}>{item.progress}%</Text>}
              </View>
            ))}
          </View>
        )}

        {!locked && (
          <View style={styles.actions}>
            {pendingItems.length > 0 && (
              <TouchableOpacity style={[styles.actionBtn, styles.uploadBtn]} onPress={handleUploadPress}>
                <View style={styles.actionBtnInner}>
                  <Text style={styles.actionIcon}>⬆</Text>
                  <Text style={styles.actionLabel}>{uploadBtnLabel()}</Text>
                </View>
                <View style={styles.badge}><Text style={styles.badgeText}>{pendingItems.length}</Text></View>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.recordBtn]}
              onPress={() => router.push({ pathname: "/(app)/project/record", params: { id: String(projectId), name: projectName } })}
            >
              <View style={styles.actionBtnInner}>
                <Text style={styles.actionIcon}>⏺</Text>
                <Text style={styles.actionLabel}>Record</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  errorText: { fontSize: 14, color: colors.error, textAlign: "center", paddingHorizontal: 24 },
  lockedBanner: { backgroundColor: colors.warningBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.warning },
  lockedText: { fontSize: 14, color: colors.warning, fontWeight: "500" },
  meta: { paddingVertical: 4 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  section: { gap: 0 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  queueItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10, borderWidth: 1, borderColor: colors.border },
  queueItemIcon: { fontSize: 18 },
  queueItemBody: { flex: 1, gap: 4 },
  queueItemName: { color: colors.text, fontSize: 13, fontWeight: "500" },
  queueItemError: { color: colors.error, fontSize: 11 },
  queueItemPct: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  miniProgressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" },
  miniProgressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.brandIndigo },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center", position: "relative" },
  actionBtnInner: { alignItems: "center", gap: 6 },
  uploadBtn: { backgroundColor: colors.brandIndigoLight, borderColor: colors.brandIndigo },
  recordBtn: { backgroundColor: colors.brandVioletLight, borderColor: colors.brandViolet },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  badge: { position: "absolute", top: -8, right: -8, backgroundColor: colors.brandIndigo, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
