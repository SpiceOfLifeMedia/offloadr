import { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";
import { PROGRAMS } from "@/data/programs";
import { useProgramStore } from "@/store/programs";

const { width } = Dimensions.get("window");

function AnimatedBackground() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 7000, useNativeDriver: false }),
        Animated.timing(a, { toValue: 0, duration: 7000, useNativeDriver: false }),
      ])
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 9000, useNativeDriver: false }),
          Animated.timing(b, { toValue: 0, duration: 9000, useNativeDriver: false }),
        ])
      ).start();
    }, 2000);
  }, []);

  const blob1Top = a.interpolate({ inputRange: [0, 1], outputRange: [60, 140] });
  const blob2Top = b.interpolate({ inputRange: [0, 1], outputRange: [220, 300] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.blob, { top: blob1Top, left: -60, backgroundColor: "rgba(99,102,241,0.10)" }]} />
      <Animated.View style={[styles.blob, { top: blob2Top, right: -80, backgroundColor: "rgba(139,92,246,0.08)", width: 260, height: 260 }]} />
    </View>
  );
}

function ProgramCard({ program, onPress }: { program: typeof PROGRAMS[0]; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <LinearGradient
        colors={["rgba(99,102,241,0.10)", "rgba(139,92,246,0.04)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.cardTopBar} />
      <Text style={styles.cardTitle}>{program.title}</Text>
      <Text style={styles.cardDesc}>{program.description}</Text>
      <View style={styles.cardMeta}>
        <View style={styles.metaPill}>
          <Text style={styles.metaText}>{program.prompts.length} prompts</Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaText}>~{program.estimatedMinutes} min</Text>
        </View>
      </View>
      <View style={styles.cardArrow}>
        <Text style={styles.cardArrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProgramsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const resetSession = useProgramStore((s) => s.resetSession);

  const handleSelect = (programId: string) => {
    resetSession();
    router.push({ pathname: "/(app)/program/[id]", params: { id: programId } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AnimatedBackground />
      <View style={styles.header}>
        <Text style={styles.title}>Offloadr Programs</Text>
        <Text style={styles.subtitle}>Guided recording. Automatic production. Amazing results.</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {PROGRAMS.map((p) => (
          <ProgramCard key={p.id} program={p} onPress={() => handleSelect(p.id)} />
        ))}
        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  blob: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 6,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  list: { paddingHorizontal: 16, gap: 14 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    overflow: "hidden",
    backgroundColor: colors.surface,
    gap: 8,
    minHeight: 130,
  },
  cardTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.brandIndigo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  cardDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  cardMeta: { flexDirection: "row", gap: 8, marginTop: 4 },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
  },
  metaText: { fontSize: 11, fontWeight: "600", color: colors.brandIndigo },
  cardArrow: { position: "absolute", right: 18, top: "50%", marginTop: -14 },
  cardArrowText: { fontSize: 28, color: "rgba(255,255,255,0.25)", fontWeight: "300" },
});
