import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { getProgramById } from "@/data/programs";
import { useProgramStore } from "@/store/programs";

export default function ProgramDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const startProgram = useProgramStore((s) => s.startProgram);

  const program = getProgramById(id ?? "");

  if (!program) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.error}>Program not found.</Text>
      </View>
    );
  }

  const handleStart = () => {
    startProgram(program.id);
    router.push("/(app)/program/question");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.08)", "transparent"]}
        style={styles.headerGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{program.prompts.length} prompts · ~{program.estimatedMinutes} min</Text>
          </View>
          <Text style={styles.programTitle}>{program.title}</Text>
          <Text style={styles.programDesc}>{program.description}</Text>
        </View>

        <View style={styles.promptSection}>
          <Text style={styles.promptSectionLabel}>What you will be asked</Text>
          {program.prompts.map((prompt, idx) => (
            <View key={prompt.id} style={styles.promptRow}>
              <View style={styles.promptNumber}>
                <Text style={styles.promptNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.promptQuestion}>{prompt.question}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.startBtnText}>Start Program</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  error: { color: colors.error, margin: 24, fontSize: 16 },
  topBar: { paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 2 },
  backText: { fontSize: 16, color: colors.brandIndigo, fontWeight: "600" },
  scroll: { paddingHorizontal: 24 },
  hero: { gap: 12, paddingBottom: 32, paddingTop: 8 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(99,102,241,0.14)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: colors.brandIndigo },
  programTitle: { fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -0.5, lineHeight: 38 },
  programDesc: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  promptSection: { gap: 12 },
  promptSectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  promptRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  promptNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    flexShrink: 0,
  },
  promptNumberText: { fontSize: 13, fontWeight: "700", color: colors.brandIndigo },
  promptQuestion: { fontSize: 16, color: colors.text, lineHeight: 22, flex: 1, paddingTop: 4 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startBtn: {
    height: 58,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: { fontSize: 18, fontWeight: "700", color: colors.white, letterSpacing: -0.2 },
});
