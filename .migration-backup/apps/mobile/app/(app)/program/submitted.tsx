import { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

export default function SubmittedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, resetSession } = useProgramStore();
  const program = getProgramById(programId ?? "");

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: false }),
    ]).start();
  }, []);

  const handleBack = () => {
    resetSession();
    router.replace("/(app)/programs");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.14)", "rgba(139,92,246,0.08)", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.center}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }], opacity }]}>
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.iconInner}>
            <Text style={styles.iconCheck}>✓</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.textGroup, { opacity }]}>
          <Text style={styles.title}>Sent to Teacher</Text>
          {program && <Text style={styles.programName}>{program.title}</Text>}
          <Text style={styles.message}>
            Your program has been delivered. Your teacher can now review it.
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.85}>
          <Text style={styles.backBtnText}>Back to Programs</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 36,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  iconInner: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCheck: {
    fontSize: 52,
    color: colors.brandIndigo,
    fontWeight: "800",
  },
  textGroup: { alignItems: "center", gap: 10 },
  title: { fontSize: 34, fontWeight: "800", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  programName: { fontSize: 16, fontWeight: "600", color: colors.brandIndigo },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 17, fontWeight: "700", color: colors.text },
});
