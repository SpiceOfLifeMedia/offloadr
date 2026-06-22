import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import { loginAndGetSession } from "@/api/client";
import { TextInputField } from "@/components/TextInputField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/constants/colors";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orgSlug } = useLocalSearchParams<{ orgSlug: string }>();
  const { setUser } = useAuthStore();
  const { addRecent } = useWorkspaceStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const u = username.trim();
    if (!u) { setError("Enter your username."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true); setError("");
    const result = await loginAndGetSession({ organizationSlug: orgSlug ?? "", username: u, password });
    setLoading(false);
    if (!result.ok) { setError(result.message); return; }
    await setUser({ sessionToken: result.sessionToken, studentId: result.studentId, displayName: result.displayName, orgId: result.orgId, orgSlug: result.orgSlug, orgName: result.orgName });
    await addRecent(result.orgSlug, result.orgName || result.orgSlug);
    router.replace("/(app)/home");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>‹ Change school</Text>
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}><Text style={styles.orgSlug}>{orgSlug}</Text></Text>
        </View>
        <View style={styles.form}>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          <TextInputField label="Username" placeholder="your.name" value={username} onChangeText={(v) => { setUsername(v); setError(""); }} textContentType="username" returnKeyType="next" />
          <TextInputField label="Password" placeholder="••••••••" value={password} onChangeText={(v) => { setPassword(v); setError(""); }} secureTextEntry textContentType="password" returnKeyType="go" onSubmitEditing={() => { void handleLogin(); }} />
          <PrimaryButton label="Sign In" onPress={() => { void handleLogin(); }} loading={loading} style={{ marginTop: 4 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  back: { alignSelf: "flex-start" },
  backText: { fontSize: 15, color: colors.brandIndigo, fontWeight: "500" },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  orgSlug: { color: colors.brandIndigo, fontWeight: "600" },
  form: { gap: 16 },
  errorBox: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: 10, padding: 12 },
  errorText: { fontSize: 14, color: colors.error, lineHeight: 20 },
});
