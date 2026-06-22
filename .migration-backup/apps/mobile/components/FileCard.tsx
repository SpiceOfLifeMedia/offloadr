import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

type FileStatus = "draft" | "submitted";

interface FileCardProps {
  fileName: string;
  fileSize: number;
  status: FileStatus;
  uploadedAt?: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return ""; }
}

function getFileEmoji(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(ext)) return "🎬";
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg"].includes(ext)) return "🎵";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "🖼";
  return "📄";
}

export function FileCard({ fileName, fileSize, status, uploadedAt }: FileCardProps) {
  const isSubmitted = status === "submitted";
  return (
    <View style={styles.card}>
      <View style={styles.icon}><Text style={styles.iconText}>{getFileEmoji(fileName)}</Text></View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{fileName}</Text>
        <Text style={styles.meta}>{formatBytes(fileSize)}{uploadedAt ? `  ·  ${formatDate(uploadedAt)}` : ""}</Text>
      </View>
      <View style={[styles.badge, isSubmitted ? styles.badgeSubmitted : styles.badgeDraft]}>
        <Text style={[styles.badgeText, isSubmitted ? styles.badgeTextSubmitted : styles.badgeTextDraft]}>
          {isSubmitted ? "Sent" : "Draft"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 20 },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: "500", color: colors.text },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDraft: { backgroundColor: colors.brandIndigoLight },
  badgeSubmitted: { backgroundColor: colors.successBg },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeTextDraft: { color: colors.brandIndigo },
  badgeTextSubmitted: { color: colors.success },
});
