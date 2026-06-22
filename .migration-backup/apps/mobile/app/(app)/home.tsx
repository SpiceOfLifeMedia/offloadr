import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { offloadrApi, type StudentProject } from "@/api/client";
import { ProjectCard } from "@/components/ProjectCard";
import { colors } from "@/constants/colors";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await offloadrApi.student.projects.list();
    if (res.ok && res.data?.projects) { setProjects(res.data.projects); setError(null); }
    else setError(res.message ?? "Failed to load projects.");
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}, <Text style={styles.name}>{firstName}</Text></Text>
        <Text style={styles.subhead}>{projects.length === 0 && !loading ? "No projects assigned yet." : `${projects.length} project${projects.length === 1 ? "" : "s"} assigned`}</Text>
      </View>
      {loading && <View style={styles.center}><ActivityIndicator color={colors.brandIndigo} /></View>}
      {!loading && error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
      {!loading && !error && (
        <FlatList
          data={projects}
          keyExtractor={(item) => String(item.projectId)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} tintColor={colors.brandIndigo} />}
          renderItem={({ item }) => (
            <ProjectCard projectName={item.projectName} organizationName={item.organizationName}
              onPress={() => router.push({ pathname: "/(app)/project/[id]", params: { id: String(item.projectId), name: item.projectName } })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No projects assigned yet.</Text>
              <Text style={styles.emptyHint}>Your teacher will assign projects when they're ready.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 },
  greeting: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  name: { color: colors.brandIndigo },
  subhead: { fontSize: 13, color: colors.textSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  errorBox: { margin: 16, padding: 14, backgroundColor: colors.errorBg, borderRadius: 10, borderWidth: 1, borderColor: colors.errorBorder },
  errorText: { fontSize: 14, color: colors.error },
  empty: { alignItems: "center", gap: 8, paddingTop: 60 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptyHint: { fontSize: 13, color: colors.textTertiary, textAlign: "center", paddingHorizontal: 32 },
});
