import { useState, useRef } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import { loginAndGetSession } from "@/api/client";
import { TextInputField } from "@/components/TextInputField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/constants/colors";

export default function StudentLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { addRecent } = useWorkspaceStore();

  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clearError = () => setError("");

  const handleLogin = async () => {
    const slug = schoolCode.trim().toLowerCase();
    const u = username.trim();
    if (!slug) { setError("Enter your school code."); return; }
    if (!u) { setError("Enter your username."); return; }
    if (!password) { setError("Enter your password."); return; }

    setLoading(true);
    setError("");

    const result = await loginAndGetSession({ organizationSlug: slug, username: u, password });
    setLoading(false);

    if (!result.ok) { setError(result.message); return; }

    await setUser({
      sessionToken: result.sessionToken,
      studentId: result.studentId,
      displayName: result.displayName,
      orgId: result.orgId,
      orgSlug: result.orgSlug,
      orgName: result.orgName,
    });
    await addRecent(result.orgSlug, result.orgName || result.orgSlug);
    router.replace("/(app)/home");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Find Your School</Text>
          <Text style={styles.subtitle}>Sign in with your school credentials to start creating.</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInputField
            label="School Code"
            placeholder="e.g. westside-academy"
            value={schoolCode}
            onChangeText={(v) => { setSchoolCode(v); clearError(); }}
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
          />
          <TextInputField
            label="Username"
            placeholder="your.name"
            value={username}
            onChangeText={(v) => { setUsername(v); clearError(); }}
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            ref={usernameRef}
          />
          <TextInputField
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => { setPassword(v); clearError(); }}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => { void handleLogin(); }}
            ref={passwordRef}
          />

          <PrimaryButton
            label="Start Creating"
            onPress={() => { void handleLogin(); }}
            loading={loading}
            style={{ marginTop: 8, height: 56 }}
          />

          <TouchableOpacity style={styles.secondaryAction} onPress={() => {}} activeOpacity={0.7}>
            <Text style={styles.secondaryText}>Use Upload Code</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  back: { alignSelf: "flex-start" },
  backText: { fontSize: 15, color: colors.brandIndigo, fontWeight: "600" },
  header: { gap: 8 },
  title: { fontSize: 30, fontWeight: "700", color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 22 },
  form: { gap: 16 },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 12,
    padding: 14,
  },
  errorText: { fontSize: 14, color: colors.error, lineHeight: 20 },
  secondaryAction: { alignItems: "center", paddingVertical: 12 },
  secondaryText: { fontSize: 14, color: "rgba(255,255,255,0.4)", fontWeight: "500" },
});
