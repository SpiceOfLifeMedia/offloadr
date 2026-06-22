import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/constants/colors";

function ComingSoonModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Coming Soon</Text>
          <Text style={styles.modalBody}>
            Teacher login is coming soon in this pilot. Check back with your school admin for access details.
          </Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function TeacherLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
      <ComingSoonModal visible={modalVisible} onClose={() => setModalVisible(false)} />

      <TouchableOpacity
        style={styles.back}
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Teacher Login</Text>
          <Text style={styles.subtitle}>
            Access your dashboard to review student work and manage projects.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.googleBtn} onPress={() => setModalVisible(true)} activeOpacity={0.82}>
            <LinearGradient
              colors={["rgba(99,102,241,0.15)", "rgba(139,92,246,0.08)"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.googleIconBox}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.emailBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
            <Text style={styles.emailBtnText}>Use Email Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pilotNotice}>
          <Text style={styles.pilotText}>
            Teacher accounts are being rolled out gradually. Your school admin will notify you when access is ready.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  back: { alignSelf: "flex-start" },
  backText: { fontSize: 15, color: colors.brandIndigo, fontWeight: "600" },
  content: { flex: 1, justifyContent: "center", gap: 36, marginTop: -40 },
  header: { gap: 10 },
  title: { fontSize: 30, fontWeight: "700", color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 22 },
  actions: { gap: 16 },
  googleBtn: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 14,
    overflow: "hidden",
  },
  googleIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: { fontSize: 15, fontWeight: "700", color: colors.white },
  googleBtnText: { fontSize: 16, fontWeight: "600", color: colors.white },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dividerText: { fontSize: 13, color: "rgba(255,255,255,0.3)" },
  emailBtn: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  emailBtnText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.55)" },
  pilotNotice: {
    backgroundColor: "rgba(99,102,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.2)",
    borderRadius: 12,
    padding: 16,
  },
  pilotText: { fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 20, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalCard: {
    backgroundColor: "#1a1a2c",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.white },
  modalBody: { fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 22 },
  modalBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.brandIndigo,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  modalBtnText: { fontSize: 15, fontWeight: "600", color: colors.white },
});
