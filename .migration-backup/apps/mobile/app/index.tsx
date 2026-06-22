import { useEffect } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";

const logo = require("../assets/images/logo.png");

export default function SplashEntry() {
  const router = useRouter();
  const { user, isRestoring } = useAuthStore();

  useEffect(() => {
    if (isRestoring) return;
    const t = setTimeout(() => {
      if (user) {
        router.replace("/(app)/home");
      } else {
        router.replace("/welcome");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [isRestoring, user]);

  return (
    <View style={styles.root}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.tagline}>Student media uploads, simplified.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  logo: {
    width: 280,
    height: 80,
    tintColor: undefined,
  },
  tagline: {
    fontSize: 14,
    color: "#ffffff",
    opacity: 0.6,
    letterSpacing: 0.2,
  },
});
