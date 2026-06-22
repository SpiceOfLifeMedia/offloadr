import { View, Text, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { offloadrApi } from "@/api/client";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/constants/colors";

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last ? null : styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await offloadrApi.student.auth.logout().catch(() => {});
          await clearUser();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.displayName?.[0] ?? "?").toUpperCase()}</Text></View>
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{user?.displayName ?? "Student"}</Text>
          <Text style={styles.orgName}>{user?.orgName || user?.orgSlug}</Text>
        </View>
      </View>
      <View style={styles.infoCard}>
        <InfoRow label="School Code" value={user?.orgSlug ?? "—"} />
        <InfoRow label="Student ID" value={user ? String(user.studentId) : "—"} last />
      </View>
      <View style={styles.bottom}>
        <PrimaryButton label="Sign Out" onPress={handleSignOut} variant="danger" />
        <Text style={styles.version}>Offloadr Mobile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, gap: 20 },
  profile: { flexDirection: "row", alignItems: "center", paddingTop: 28, gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandIndigoLight, borderWidth: 2, borderColor: colors.brandIndigo, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: colors.brandIndigo },
  profileInfo: { gap: 3 },
  displayName: { fontSize: 20, fontWeight: "700", color: colors.text },
  orgName: { fontSize: 13, color: colors.textSecondary },
  infoCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: "500", color: colors.text },
  bottom: { flex: 1, justifyContent: "flex-end", paddingBottom: 24, gap: 14 },
  version: { textAlign: "center", fontSize: 12, color: colors.textTertiary },
});
