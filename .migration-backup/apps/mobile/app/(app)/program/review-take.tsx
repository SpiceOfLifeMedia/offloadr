import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

export default function ReviewTakeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, currentPromptIndex, takes, keepTake, goToNextPrompt } = useProgramStore();
  const program = getProgramById(programId ?? "");

  useEffect(() => {
    if (!programId) router.replace("/(app)/programs");
  }, [programId]);

  if (!program) return null;

  const prompt = program.prompts[currentPromptIndex];
  const take = takes[prompt.id];
  const isLast = currentPromptIndex === program.prompts.length - 1;

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const handleKeep = () => {
    keepTake(prompt.id);
    if (isLast) {
      router.replace("/(app)/program/progress");
    } else {
      goToNextPrompt();
      router.replace("/(app)/program/question");
    }
  };

  const handleRerecord = () => {
    router.replace("/(app)/program/countdown");
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
        <Text style={styles.headerLabel}>Review your take</Text>
        <Text style={styles.questionText}>{prompt.question}</Text>
      </View>

      {/* Playback preview placeholder */}
      <View style={styles.previewArea}>
        <View style={styles.previewPlaceholder}>
          <View style={styles.playIcon}>
            <Text style={styles.playIconText}>▶</Text>
          </View>
          <Text style={styles.previewLabel}>Your recording</Text>
          {take && (
            <Text style={styles.previewMeta}>Duration: {formatDuration(take.durationSeconds)}</Text>
          )}
          <Text style={styles.previewHint}>Video playback will appear here</Text>
        </View>
      </View>

      <View style={styles.promptNumber}>
        <Text style={styles.promptNumberText}>
          Question {currentPromptIndex + 1} of {program.prompts.length}
        </Text>
        {isLast && (
          <View style={styles.lastBadge}>
            <Text style={styles.lastBadgeText}>Last question</Text>
          </View>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.keepBtn} onPress={handleKeep} activeOpacity={0.85}>
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.keepBtnText}>{isLast ? "Keep Take" : "Keep Take"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rerecordBtn} onPress={handleRerecord} activeOpacity={0.82}>
          <Text style={styles.rerecordBtnText}>Re-record</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 250 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, gap: 10 },
  headerLabel: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 1.5, textTransform: "uppercase" },
  questionText: { fontSize: 22, fontWeight: "800", color: colors.text, lineHeight: 28, letterSpacing: -0.3 },
  previewArea: { flex: 1, marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  previewPlaceholder: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  playIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(99,102,241,0.18)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIconText: { fontSize: 22, color: colors.brandIndigo, marginLeft: 4 },
  previewLabel: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  previewMeta: { fontSize: 13, color: colors.brandIndigo, fontWeight: "600" },
  previewHint: { fontSize: 12, color: colors.textTertiary },
  promptNumber: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 10,
  },
  promptNumberText: { fontSize: 13, color: colors.textTertiary, fontWeight: "600" },
  lastBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
  },
  lastBadgeText: { fontSize: 11, fontWeight: "700", color: colors.brandIndigo },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  keepBtn: {
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  keepBtnText: { fontSize: 18, fontWeight: "700", color: colors.white, letterSpacing: -0.2 },
  rerecordBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  rerecordBtnText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
});
