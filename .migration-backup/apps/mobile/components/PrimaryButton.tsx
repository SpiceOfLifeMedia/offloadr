import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, type ViewStyle } from "react-native";
import { colors } from "@/constants/colors";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, loading = false, disabled = false, variant = "primary", style }: PrimaryButtonProps) {
  const bg = variant === "danger" ? colors.errorBg : variant === "secondary" ? colors.surface : colors.brandIndigo;
  const textColor = variant === "danger" ? colors.error : colors.white;
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[styles.btn, { backgroundColor: bg, opacity: isDisabled ? 0.5 : 1 }, variant === "secondary" && styles.secondaryBorder, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  secondaryBorder: { borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 15, fontWeight: "600", letterSpacing: 0.2 },
});
