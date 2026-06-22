import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/auth";
import { useWorkspaceStore } from "@/store/workspace";
import { useUploadQueue } from "@/hooks/useUploadQueue";

SplashScreen.preventAutoHideAsync();

function QueueProcessor() {
  useUploadQueue();
  return null;
}

export default function RootLayout() {
  const { restore, isRestoring } = useAuthStore();
  const { loadRecents } = useWorkspaceStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([restore(), loadRecents()]).finally(() => {
      setReady(true);
      void SplashScreen.hideAsync();
    });
  }, []);

  if (!ready || isRestoring) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueueProcessor />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="student-login" />
          <Stack.Screen name="teacher-login" />
          <Stack.Screen name="workspace" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(app)" options={{ animation: "fade" }} />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
