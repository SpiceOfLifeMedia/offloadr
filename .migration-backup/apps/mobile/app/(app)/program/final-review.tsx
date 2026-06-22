import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

export default function FinalReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, keptPromptIds, takes, setCurrentPromptIndex, submitProgram } = useProgramStore();
  const program = getProgramById(programId ?? "");

  useEffect(() => {
    if (!programId) router.replace("/(app)/programs");
  }, [programId]);

  if (!program) return null;

  const orderedTakes = keptPromptIds
    .map((pid) => ({
      prompt: program.prompts.find((p) => p.id === pid),
      take: takes[pid],
    }))
    .filter((t) => t.prompt != null);

  const handleRerecord = (promptId: string) => {
    const idx = program.prompts.findIndex((p) => p.id === promptId);
    if (idx >= 0) {
      setCurrentPromptIndex(idx);
      router.push("/(app)/program/question");
    }
  };

  const handleSend = () => {
    submitProgram();
    router.replace("/(app)/program/submitted");
  };

  const formatDuration = (s: number) => `${s}s`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.07)", "transparent"]}
        style={styles.topGrad}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Your Sequence</Text>
        <Text style={styles.subtitle}>{program.title} · {orderedTakes.length} takes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {orderedTakes.map(({ prompt, take }, idx) => (
          <View key={prompt!.id} style={styles.takeCard}>
            <LinearGradient
              colors={["rgba(99,102,241,0.06)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.takeCardLeft}>
              <View style={styles.takeNumber}>
                <Text style={styles.takeNumberText}>{idx + 1}</Text>
              </View>
              <View style={styles.takeInfo}>
                <Text style={styles.takeQuestion}>{prompt!.question}</Text>
                {take && (
                  <Text style={styles.takeMeta}>Duration: {formatDuration(take.durationSeconds)}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.rerecordBtn}
              onPress={() => handleRerecord(prompt!.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.rerecordBtnText}>Re-record</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.footerHint}>Once sent, your teacher will receive the full sequence.</Text>
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.85}>
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.sendBtnText}>Send to Teacher</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  topBar: { paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 2 },
  backText: { fontSize: 16, color: colors.brandIndigo, fontWeight: "600" },
  header: { paddingHorizontal: 24, paddingBottom: 20, gap: 6 },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  list: { paddingHorizontal: 16, gap: 10 },
  takeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    backgroundColor: colors.surface,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  takeCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  takeNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(99,102,241,0.14)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  takeNumberText: { fontSize: 14, fontWeight: "800", color: colors.brandIndigo },
  takeInfo: { flex: 1, gap: 4 },
  takeQuestion: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 18 },
  takeMeta: { fontSize: 12, color: colors.brandIndigo, fontWeight: "600" },
  rerecordBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rerecordBtnText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  footerHint: { fontSize: 12, color: colors.textTertiary, textAlign: "center" },
  sendBtn: {
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { fontSize: 18, fontWeight: "700", color: colors.white, letterSpacing: -0.2 },
});
