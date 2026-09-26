import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A themed single-line text input.
export function TextField({ style, ...props }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      selectionColor={theme.accent}
      cursorColor={theme.accent}
      maxFontSizeMultiplier={1.6}
      {...props}
      style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
