import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { colors } from "@/constants/colors";

type RecordMode = "video" | "photo" | "audio";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Lazily import native modules to avoid web crashes
let CameraView: React.ComponentType<{ ref?: React.Ref<unknown>; style?: object; facing?: string; mode?: string }> | null = null;
let useCameraPermissions: (() => [{ granted: boolean } | null, () => Promise<void>]) | null = null;
let Audio: { Recording: { createAsync: (opts: unknown) => Promise<{ recording: unknown }>; RecordingOptionsPresets: { HIGH_QUALITY: unknown } }; Sound: { createAsync: (src: unknown, opts?: unknown, cb?: unknown) => Promise<{ sound: unknown }> }; requestPermissionsAsync: () => Promise<{ granted: boolean }>; setAudioModeAsync: (opts: unknown) => Promise<void> } | null = null;
let FileSystem: { getInfoAsync: (uri: string, opts?: { size?: boolean }) => Promise<{ exists: boolean; size?: number }>; deleteAsync: (uri: string, opts?: { idempotent?: boolean }) => Promise<void> } | null = null;

if (Platform.OS !== "web") {
  try { const cam = require("expo-camera"); CameraView = cam.CameraView; useCameraPermissions = cam.useCameraPermissions; } catch {}
  try { Audio = require("expo-av").Audio; } catch {}
  try { FileSystem = require("expo-file-system"); } catch {}
}

function WebPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Camera not available on web</Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 32, textAlign: "center", paddingHorizontal: 32 }}>Use Expo Go on your phone to record video, photos, or audio.</Text>
      <TouchableOpacity onPress={onBack} style={{ backgroundColor: colors.brandIndigo, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}>
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RecordScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const projectId = parseInt(id ?? "0", 10);
  const projectName = name ?? "";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<RecordMode>("video");
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const cameraRef = useRef<unknown>(null);
  const audioRecordingRef = useRef<unknown>(null);
  const isRecordingRef = useRef(false);
  const discardingRef = useRef(false);

  const cameraPermHook = useCameraPermissions ? useCameraPermissions() : [null, async () => {}];
  const cameraPermission = cameraPermHook[0];
  const requestCameraPermission = cameraPermHook[1];

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording || mode !== "audio") { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isRecording, mode]);

  useEffect(() => {
    if (!isRecording || isPaused) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        discardingRef.current = true;
        (cameraRef.current as { stopRecording?: () => void })?.stopRecording?.();
      }
      if (audioRecordingRef.current) {
        (audioRecordingRef.current as { stopAndUnloadAsync: () => Promise<void> }).stopAndUnloadAsync().catch(() => {});
        audioRecordingRef.current = null;
      }
    };
  }, []);

  if (Platform.OS === "web" || !CameraView) {
    return <WebPlaceholder onBack={() => router.back()} />;
  }

  async function finishCapture(uri: string, contentType: string, fileName: string, durationMs?: number) {
    let fileSize = 0;
    if (FileSystem) {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      fileSize = info.exists && "size" in info && info.size ? info.size : 0;
    }
    router.push({ pathname: "/(app)/project/review", params: { id: String(projectId), name: projectName, localUri: uri, fileName, contentType, fileSize: String(fileSize), durationMs: durationMs ? String(durationMs) : "" } });
  }

  async function startVideoRecording() {
    if (!(cameraRef.current as { recordAsync?: (o: object) => Promise<{ uri: string } | undefined> })?.recordAsync || isRecordingRef.current) return;
    isRecordingRef.current = true; discardingRef.current = false;
    setIsRecording(true); setIsPaused(false); setElapsedSeconds(0);
    try {
      const result = await (cameraRef.current as { recordAsync: (o: object) => Promise<{ uri: string } | undefined> }).recordAsync({ maxDuration: 3600 });
      if (result?.uri && !discardingRef.current) await finishCapture(result.uri, "video/mp4", `video_${Date.now()}.mp4`);
      else if (result?.uri && discardingRef.current) await FileSystem?.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
    } catch {} finally { isRecordingRef.current = false; setIsRecording(false); setIsPaused(false); }
  }

  function stopVideoRecording() { (cameraRef.current as { stopRecording?: () => void })?.stopRecording?.(); }
  function pauseRecording() { try { (cameraRef.current as { pauseRecording?: () => void })?.pauseRecording?.(); } catch {} setIsPaused(true); }
  function resumeRecording() { try { (cameraRef.current as { resumeRecording?: () => void })?.resumeRecording?.(); } catch {} setIsPaused(false); }

  async function takePhoto() {
    if (!(cameraRef.current as { takePictureAsync?: (o: object) => Promise<{ uri: string }> })?.takePictureAsync || isRecordingRef.current) return;
    try {
      const result = await (cameraRef.current as { takePictureAsync: (o: object) => Promise<{ uri: string }> }).takePictureAsync({ quality: 0.85 });
      if (result?.uri) await finishCapture(result.uri, "image/jpeg", `photo_${Date.now()}.jpg`);
    } catch { Alert.alert("Error", "Could not take photo."); }
  }

  async function startAudioRecording() {
    if (isRecordingRef.current || !Audio) return;
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) { Alert.alert("Permission Needed", "Microphone access is required."); return; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.Recording.RecordingOptionsPresets.HIGH_QUALITY);
    audioRecordingRef.current = recording; isRecordingRef.current = true; setIsRecording(true); setElapsedSeconds(0);
  }

  async function stopAudioRecording() {
    const recording = audioRecordingRef.current as { stopAndUnloadAsync: () => Promise<void>; getURI: () => string | null; getStatusAsync: () => Promise<unknown> } | null;
    if (!recording || !Audio) return;
    audioRecordingRef.current = null; isRecordingRef.current = false; setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      const durationMs = (status as { durationMillis?: number }).durationMillis ?? 0;
      if (uri) await finishCapture(uri, "audio/m4a", `audio_${Date.now()}.m4a`, durationMs);
    } catch { Alert.alert("Error", "Could not save recording."); }
  }

  function handleBack() {
    if (isRecordingRef.current) {
      if (mode === "video") { discardingRef.current = true; (cameraRef.current as { stopRecording?: () => void })?.stopRecording?.(); }
      else if (mode === "audio" && audioRecordingRef.current) {
        const rec = audioRecordingRef.current as { stopAndUnloadAsync: () => Promise<void> };
        audioRecordingRef.current = null; isRecordingRef.current = false;
        void rec.stopAndUnloadAsync().catch(() => {});
        void Audio?.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      }
    }
    router.back();
  }

  if (mode !== "audio") {
    if (!cameraPermission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;
    if (!cameraPermission.granted) {
      return (
        <View style={styles.permissionScreen}>
          <TouchableOpacity onPress={handleBack} style={[styles.headerBtn, { top: insets.top + 12, left: 16, position: "absolute" }]}><Text style={styles.headerBtnText}>✕</Text></TouchableOpacity>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionDesc}>Offloadr needs camera access to record your performance.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={() => void requestCameraPermission()}><Text style={styles.permissionBtnText}>Grant Permission</Text></TouchableOpacity>
        </View>
      );
    }
  }

  const NativeCameraView = CameraView as React.ComponentType<{ ref: React.Ref<unknown>; style: object; facing: string; mode: string }>;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {mode !== "audio" && <NativeCameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraFacing} mode="video" />}
      {mode === "audio" && (
        <View style={styles.audioUI}>
          <Animated.View style={[styles.audioMicCircle, { transform: [{ scale: pulseAnim }] }, isRecording && styles.audioMicCircleRecording]}>
            <Text style={styles.audioMicIcon}>🎙</Text>
          </Animated.View>
          {isRecording ? <Text style={styles.audioRecordingLabel}>Recording…</Text> : <Text style={styles.audioIdleLabel}>Tap to start recording</Text>}
        </View>
      )}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}><Text style={styles.headerBtnText}>✕</Text></TouchableOpacity>
        {isRecording ? (
          <View style={styles.timerBadge}><View style={styles.timerDot} /><Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text></View>
        ) : (
          <Text style={styles.headerTitle} numberOfLines={1}>{projectName}</Text>
        )}
        {mode !== "audio" ? (
          <TouchableOpacity onPress={() => setCameraFacing((f) => f === "back" ? "front" : "back")} style={[styles.headerBtn, isRecording && styles.headerBtnDisabled]} disabled={isRecording}>
            <Text style={styles.headerBtnText}>⇄</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerBtn} />}
      </View>
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {!isRecording && (
          <View style={styles.modeSelector}>
            {(["video", "photo", "audio"] as RecordMode[]).map((m) => (
              <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.modeTab, mode === m && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>{m === "video" ? "VIDEO" : m === "photo" ? "PHOTO" : "AUDIO"}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.actionRow}>
          {isRecording && mode === "video" ? (
            <>
              <TouchableOpacity onPress={isPaused ? resumeRecording : pauseRecording} style={styles.controlBtn}>
                <Text style={styles.controlBtnText}>{isPaused ? "▶" : "⏸"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={stopVideoRecording} style={styles.stopBtn}><View style={styles.stopSquare} /></TouchableOpacity>
            </>
          ) : isRecording && mode === "audio" ? (
            <TouchableOpacity onPress={() => void stopAudioRecording()} style={styles.stopBtn}><View style={styles.stopSquare} /></TouchableOpacity>
          ) : mode === "photo" ? (
            <TouchableOpacity onPress={() => void takePhoto()} style={styles.shutterBtn}><View style={styles.shutterInner} /></TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={mode === "video" ? () => void startVideoRecording() : () => void startAudioRecording()} style={styles.recordTriggerBtn}>
              <View style={styles.recordCircle} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  headerBtnDisabled: { opacity: 0.3 },
  headerBtnText: { color: "#fff", fontSize: 18 },
  headerTitle: { color: "#fff", fontWeight: "600", fontSize: 15, flex: 1, textAlign: "center", marginHorizontal: 8 },
  timerBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  timerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff3b30" },
  timerText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  audioUI: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  audioMicCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  audioMicCircleRecording: { backgroundColor: "rgba(255,59,48,0.2)" },
  audioMicIcon: { fontSize: 52 },
  audioRecordingLabel: { color: "#ff3b30", fontWeight: "600", fontSize: 16 },
  audioIdleLabel: { color: "rgba(255,255,255,0.6)", fontSize: 15 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.7)", paddingTop: 16, alignItems: "center", gap: 20 },
  modeSelector: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 4 },
  modeTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  modeTabActive: { backgroundColor: "rgba(255,255,255,0.9)" },
  modeTabText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 },
  modeTabTextActive: { color: "#000" },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 8 },
  recordTriggerBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  recordCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#ff3b30" },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  stopBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  stopSquare: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#ff3b30" },
  controlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  controlBtnText: { color: "#fff", fontSize: 22 },
  permissionScreen: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  permissionTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  permissionDesc: { color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 20 },
  permissionBtn: { backgroundColor: colors.brandIndigo, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  permissionBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
