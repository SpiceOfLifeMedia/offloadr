import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, FlatList, Text, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { offloadrApi, type StudentProject } from "@/api/client";
import { ProjectCard } from "@/components/ProjectCard";
import { colors } from "@/constants/colors";

export default function ProjectsScreen() {
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

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandIndigo} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;

  return (
    <FlatList
      data={projects}
      keyExtractor={(item) => String(item.projectId)}
      contentContainerStyle={styles.list}
      style={styles.root}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} tintColor={colors.brandIndigo} />}
      renderItem={({ item }) => (
        <ProjectCard projectName={item.projectName} organizationName={item.organizationName}
          onPress={() => router.push({ pathname: "/(app)/project/[id]", params: { id: String(item.projectId), name: item.projectName } })}
        />
      )}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>📭</Text><Text style={styles.emptyText}>No projects yet.</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  errorText: { fontSize: 14, color: colors.error, textAlign: "center", paddingHorizontal: 24 },
  empty: { alignItems: "center", gap: 8, paddingTop: 80 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
});
