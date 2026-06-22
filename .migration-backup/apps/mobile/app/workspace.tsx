import { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useWorkspaceStore, type RecentWorkspace } from "@/store/workspace";
import { TextInputField } from "@/components/TextInputField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/constants/colors";

export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orgSlug, recents, setOrgSlug } = useWorkspaceStore();
  const [input, setInput] = useState(orgSlug);
  const [error, setError] = useState("");

  const handleContinue = () => {
    const slug = input.trim().toLowerCase();
    if (!slug) { setError("Enter your school code."); return; }
    setError("");
    setOrgSlug(slug);
    router.push({ pathname: "/login", params: { orgSlug: slug } });
  };

  const handleRecent = (item: RecentWorkspace) => {
    setInput(item.slug);
    setOrgSlug(item.slug);
    router.push({ pathname: "/login", params: { orgSlug: item.slug } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Offloadr</Text>
          <Text style={styles.subtitle}>Enter your school code to get started.</Text>
        </View>
        <View style={styles.form}>
          <TextInputField label="School Code" placeholder="e.g. westside-academy" value={input} onChangeText={(v) => { setInput(v); setError(""); }} error={error} onSubmitEditing={handleContinue} returnKeyType="go" autoFocus />
          <PrimaryButton label="Continue" onPress={handleContinue} style={{ marginTop: 8 }} />
        </View>
        {recents.length > 0 && (
          <View style={styles.recentsSection}>
            <Text style={styles.recentsLabel}>Recent</Text>
            <FlatList data={recents} keyExtractor={(item) => item.slug} scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.recentItem} onPress={() => handleRecent(item)} activeOpacity={0.7}>
                  <View style={styles.recentIcon}><Text style={styles.recentIconText}>🏫</Text></View>
                  <View style={styles.recentBody}>
                    <Text style={styles.recentName}>{item.name || item.slug}</Text>
                    <Text style={styles.recentSlug}>{item.slug}</Text>
                  </View>
                  <Text style={styles.recentChevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, gap: 32 },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  form: { gap: 12 },
  recentsSection: { gap: 10 },
  recentsLabel: { fontSize: 12, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  recentItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 6, gap: 12 },
  recentIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  recentIconText: { fontSize: 18 },
  recentBody: { flex: 1 },
  recentName: { fontSize: 14, fontWeight: "600", color: colors.text },
  recentSlug: { fontSize: 12, color: colors.textSecondary },
  recentChevron: { fontSize: 20, color: colors.textTertiary },
});
