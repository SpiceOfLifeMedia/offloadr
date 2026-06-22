import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

function RecordingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 500, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.recDot, { opacity }]} />;
}

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, currentPromptIndex, saveTake } = useProgramStore();
  const program = getProgramById(programId ?? "");

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!programId) { router.replace("/(app)/programs"); return; }
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [programId]);

  if (!program) return null;

  const prompt = program.prompts[currentPromptIndex];

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    saveTake(prompt.id, {
      promptId: prompt.id,
      uri: null,
      durationSeconds: elapsed,
      recordedAt: new Date().toISOString(),
    });
    router.replace("/(app)/program/review-take");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.questionBar}>
        <Text style={styles.questionText} numberOfLines={2}>{prompt.question}</Text>
      </View>

      {/* Camera placeholder */}
      <View style={styles.cameraArea}>
        <LinearGradient
          colors={["rgba(99,102,241,0.08)", "rgba(139,92,246,0.05)", "rgba(0,0,0,0)"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View style={styles.cameraPlaceholder}>
          <View style={styles.cameraIcon}>
            <Text style={styles.cameraIconText}>Camera</Text>
            <Text style={styles.cameraHint}>Live preview will appear here</Text>
          </View>
        </View>

        <View style={styles.recBadge}>
          <RecordingDot />
          <Text style={styles.recLabel}>REC</Text>
        </View>

        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.85}>
          <View style={styles.stopIcon} />
          <Text style={styles.stopBtnText}>Stop Recording</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  questionBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  questionText: { fontSize: 16, fontWeight: "700", color: colors.text, lineHeight: 22, textAlign: "center" },
  cameraArea: { flex: 1, backgroundColor: "#0a0a14", position: "relative" },
  cameraPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  cameraIcon: { alignItems: "center", gap: 10 },
  cameraIconText: { fontSize: 18, fontWeight: "700", color: "rgba(255,255,255,0.3)" },
  cameraHint: { fontSize: 13, color: "rgba(255,255,255,0.18)", textAlign: "center" },
  recBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#ef4444" },
  recLabel: { fontSize: 12, fontWeight: "800", color: "#ef4444", letterSpacing: 1.5 },
  timerBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  timerText: { fontSize: 15, fontWeight: "700", color: colors.text, letterSpacing: 1 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  stopBtn: {
    height: 60,
    borderRadius: 18,
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stopIcon: { width: 16, height: 16, borderRadius: 3, backgroundColor: colors.white },
  stopBtnText: { fontSize: 18, fontWeight: "700", color: colors.white },
});
