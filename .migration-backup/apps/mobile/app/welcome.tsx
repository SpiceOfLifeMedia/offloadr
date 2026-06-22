import { useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Easing, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const logo = require("../assets/images/logo.png");

function FloatingBar({ x, barHeight, width, delay, duration, color, opacity }: {
  x: number; barHeight: number; width: number; delay: number; duration: number; color: string; opacity: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, { toValue: -18, duration, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        bottom: SCREEN_H * 0.1,
        width,
        height: barHeight,
        borderRadius: width / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

function GlowBlob({ top, left, size, colors, delay, duration }: {
  top: number; left: number; size: number; colors: string[]; delay: number; duration: number;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 0.9, duration, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(opacity, { toValue: 0.4, duration, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={{ position: "absolute", top, left, width: size, height: size, borderRadius: size / 2, opacity, overflow: "hidden" }}>
      <LinearGradient colors={colors as any} style={{ flex: 1 }} />
    </Animated.View>
  );
}

function AnimatedBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <GlowBlob top={-80} left={SCREEN_W * 0.55} size={300} colors={["rgba(99,102,241,0.35)", "transparent"]} delay={0} duration={5000} />
      <GlowBlob top={SCREEN_H * 0.4} left={-60} size={260} colors={["rgba(139,92,246,0.25)", "transparent"]} delay={2000} duration={6500} />
      <GlowBlob top={SCREEN_H * 0.7} left={SCREEN_W * 0.6} size={200} colors={["rgba(99,102,241,0.2)", "transparent"]} delay={1000} duration={5800} />
      <FloatingBar x={SCREEN_W * 0.08} barHeight={90} width={10} delay={0} duration={4200} color="#6366f1" opacity={0.18} />
      <FloatingBar x={SCREEN_W * 0.16} barHeight={130} width={10} delay={600} duration={3800} color="#7c3aed" opacity={0.14} />
      <FloatingBar x={SCREEN_W * 0.24} barHeight={70} width={10} delay={300} duration={4600} color="#8b5cf6" opacity={0.16} />
      <FloatingBar x={SCREEN_W * 0.75} barHeight={110} width={10} delay={1200} duration={4000} color="#6366f1" opacity={0.13} />
      <FloatingBar x={SCREEN_W * 0.83} barHeight={80} width={10} delay={800} duration={5000} color="#8b5cf6" opacity={0.15} />
      <FloatingBar x={SCREEN_W * 0.91} barHeight={140} width={10} delay={400} duration={3600} color="#7c3aed" opacity={0.12} />
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <AnimatedBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoIconClip}>
            <Image source={logo} style={styles.logoImage} resizeMode="stretch" />
          </View>
          <Text style={styles.logoWordmark}>Offloadr</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Welcome to Offloadr</Text>
          <Text style={styles.subtitle}>Create. Offload. Deliver.</Text>
        </View>

        <View style={styles.cards}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/student-login")}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={["rgba(99,102,241,0.12)", "rgba(139,92,246,0.06)"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.cardAccent} />
            <Text style={styles.cardTitle}>Student</Text>
            <Text style={styles.cardDesc}>Create projects, upload media and send work to your teacher.</Text>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/teacher-login")}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={["rgba(139,92,246,0.10)", "rgba(99,102,241,0.05)"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.cardAccent, { backgroundColor: "#8b5cf6" }]} />
            <Text style={styles.cardTitle}>Teacher</Text>
            <Text style={styles.cardDesc}>Review student media, manage projects and keep production moving.</Text>
            <View style={styles.cardArrow}>
              <Text style={styles.cardArrowText}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.pilotText}>
          Pilot environment. Do not upload real student work yet.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0f" },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 32, alignItems: "stretch" },
  logoRow: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 10 },
  logoIconClip: { width: 80, height: 60, overflow: "hidden" },
  logoImage: { width: 210, height: 60 },
  logoWordmark: { fontSize: 30, fontWeight: "700", color: "#ffffff", letterSpacing: -0.5 },
  hero: { gap: 10, alignItems: "center" },
  title: { fontSize: 30, fontWeight: "700", color: "#ffffff", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 16, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5, textAlign: "center", fontWeight: "500" },
  cards: { gap: 14 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 24,
    overflow: "hidden",
    backgroundColor: "#141420",
    minHeight: 120,
    justifyContent: "center",
    gap: 8,
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#6366f1",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: "700", color: "#ffffff", letterSpacing: -0.3 },
  cardDesc: { fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 20 },
  cardArrow: { position: "absolute", right: 20, top: "50%", marginTop: -12 },
  cardArrowText: { fontSize: 28, color: "rgba(255,255,255,0.3)", fontWeight: "300" },
  pilotText: { fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 18 },
});
