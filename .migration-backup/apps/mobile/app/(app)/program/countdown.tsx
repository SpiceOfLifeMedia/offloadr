import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { useProgramStore } from "@/store/programs";
import { getProgramById } from "@/data/programs";

export default function CountdownScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programId, currentPromptIndex } = useProgramStore();
  const program = getProgramById(programId ?? "");

  const [count, setCount] = useState(3);
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    scale.setValue(0.4);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  useEffect(() => {
    animateIn();
    const intervals: ReturnType<typeof setTimeout>[] = [];
    intervals.push(setTimeout(() => { setCount(2); animateIn(); }, 1000));
    intervals.push(setTimeout(() => { setCount(1); animateIn(); }, 2000));
    intervals.push(setTimeout(() => {
      router.replace("/(app)/program/record");
    }, 3000));
    return () => intervals.forEach(clearTimeout);
  }, []);

  const prompt = program?.prompts[currentPromptIndex];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.14)", "rgba(139,92,246,0.08)", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.topSection}>
        <Text style={styles.getReadyLabel}>Get ready</Text>
        {prompt && <Text style={styles.questionPreview}>{prompt.question}</Text>}
      </View>

      <View style={styles.center}>
        <View style={styles.ring}>
          <LinearGradient
            colors={[colors.brandIndigo, colors.brandViolet]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.ringInner}>
            <Animated.Text
              style={[styles.countNumber, { transform: [{ scale }], opacity }]}
            >
              {count}
            </Animated.Text>
          </View>
        </View>
        <Text style={styles.startingLabel}>Recording starts automatically</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topSection: {
    paddingHorizontal: 28,
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
  },
  getReadyLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  questionPreview: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 28,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  ring: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  ringInner: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  countNumber: {
    fontSize: 100,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 120,
  },
  startingLabel: {
    fontSize: 14,
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});
