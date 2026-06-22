import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

export default function QuestionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, currentPromptIndex } = useProgramStore();
  const program = getProgramById(programId ?? "");

  useEffect(() => {
    if (!programId) router.replace("/(app)/programs");
  }, [programId]);

  if (!program) return null;

  const prompt = program.prompts[currentPromptIndex];
  const total = program.prompts.length;
  const progress = (currentPromptIndex + 1) / total;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.06)", "transparent"]}
        style={styles.topGrad}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.counter}>Question {currentPromptIndex + 1} of {total}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]}>
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.questionLabel}>Your question</Text>
        <Text style={styles.question}>{prompt.question}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.hint}>Take a moment to think, then hit Start Countdown when you are ready.</Text>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => router.push("/(app)/program/countdown")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.startBtnText}>Start Countdown</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 2, width: 50 },
  backText: { fontSize: 16, color: colors.brandIndigo, fontWeight: "600" },
  counter: { fontSize: 14, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.3 },
  progressTrack: {
    height: 4,
    marginHorizontal: 24,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", borderRadius: 2, overflow: "hidden" },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    gap: 20,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  question: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { fontSize: 13, color: colors.textTertiary, textAlign: "center", lineHeight: 18 },
  startBtn: {
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: { fontSize: 19, fontWeight: "700", color: colors.white, letterSpacing: -0.2 },
});
