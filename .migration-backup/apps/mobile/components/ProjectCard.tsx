import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface ProjectCardProps {
  projectName: string;
  organizationName: string;
  onPress: () => void;
}

export function ProjectCard({ projectName, organizationName, onPress }: ProjectCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{projectName}</Text>
        <Text style={styles.org} numberOfLines={1}>{organizationName}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 10 },
  accent: { width: 4, alignSelf: "stretch", backgroundColor: colors.brandIndigo },
  body: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 3 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  org: { fontSize: 13, color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textTertiary, paddingRight: 14 },
});
