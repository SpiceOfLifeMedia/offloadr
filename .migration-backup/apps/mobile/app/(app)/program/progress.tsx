import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

function StatusDot({ status }: { status: "not-started" | "recorded" | "kept" }) {
  if (status === "kept") {
    return (
      <View style={[styles.statusDot, styles.statusKept]}>
        <Text style={styles.statusKeptIcon}>✓</Text>
      </View>
    );
  }
  if (status === "recorded") {
    return <View style={[styles.statusDot, styles.statusRecorded]} />;
  }
  return <View style={[styles.statusDot, styles.statusEmpty]} />;
}

export default function ProgramProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, getStatusForPrompt, keptPromptIds, setCurrentPromptIndex } = useProgramStore();
  const program = getProgramById(programId ?? "");

  useEffect(() => {
    if (!programId) router.replace("/(app)/programs");
  }, [programId]);

  if (!program) return null;

  const allKept = keptPromptIds.length === program.prompts.length;

  const handleRerecord = (index: number) => {
    setCurrentPromptIndex(index);
    router.push("/(app)/program/question");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.07)", "transparent"]}
        style={styles.topGrad}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.header}>
        <Text style={styles.programTitle}>{program.title}</Text>
        {allKept ? (
          <View style={styles.readyBadge}>
            <LinearGradient
              colors={[colors.brandIndigo, colors.brandViolet]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text style={styles.readyBadgeText}>Ready to Send</Text>
          </View>
        ) : (
          <Text style={styles.headerSub}>
            {keptPromptIds.length} of {program.prompts.length} prompts complete
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {program.prompts.map((prompt, idx) => {
          const status = getStatusForPrompt(prompt.id);
          return (
            <View key={prompt.id} style={styles.promptRow}>
              <StatusDot status={status} />
              <View style={styles.promptInfo}>
                <Text style={styles.promptLabel}>Question {idx + 1}</Text>
                <Text style={styles.promptQuestion}>{prompt.question}</Text>
                <Text style={[
                  styles.promptStatus,
                  status === "kept" && styles.promptStatusKept,
                  status === "recorded" && styles.promptStatusRecorded,
                ]}>
                  {status === "kept" ? "Kept" : status === "recorded" ? "Recorded" : "Not started"}
                </Text>
              </View>
              {status !== "not-started" && (
                <TouchableOpacity
                  style={styles.rerecordPill}
                  onPress={() => handleRerecord(idx)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.rerecordPillText}>Re-record</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {allKept && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => router.push("/(app)/program/final-review")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.brandIndigo, colors.brandViolet]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text style={styles.reviewBtnText}>Review Sequence</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, gap: 10 },
  programTitle: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 14, color: colors.textSecondary },
  readyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: "hidden",
  },
  readyBadgeText: { fontSize: 13, fontWeight: "700", color: colors.white },
  list: { paddingHorizontal: 20, gap: 2 },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusDot: { width: 28, height: 28, borderRadius: 14, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  statusEmpty: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.border },
  statusRecorded: { backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  statusKept: { backgroundColor: "rgba(99,102,241,0.18)", borderWidth: 1, borderColor: "rgba(99,102,241,0.4)" },
  statusKeptIcon: { fontSize: 13, color: colors.brandIndigo, fontWeight: "800" },
  promptInfo: { flex: 1, gap: 2 },
  promptLabel: { fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.5 },
  promptQuestion: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 20 },
  promptStatus: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  promptStatusKept: { color: colors.brandIndigo },
  promptStatusRecorded: { color: colors.warning },
  rerecordPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rerecordPillText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
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
  reviewBtn: {
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBtnText: { fontSize: 18, fontWeight: "700", color: colors.white, letterSpacing: -0.2 },
});
