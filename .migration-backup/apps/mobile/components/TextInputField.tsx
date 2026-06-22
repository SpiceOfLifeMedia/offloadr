import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { colors } from "@/constants/colors";

interface TextInputFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextInputField({ label, error, style, ...rest }: TextInputFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style as object]}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: "500", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.errorBorder },
  error: { fontSize: 13, color: colors.error, marginTop: 2 },
});
