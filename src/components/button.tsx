import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  // Shows a spinner in place of the label and ignores presses.
  busy?: boolean;
  // primary: the screen's main action. secondary: a filled neutral button.
  // plain and danger: text-only buttons for low-emphasis and destructive actions.
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  // Buttons stretch to share a row by default; set false to size to the label.
  grow?: boolean;
};

export function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'secondary',
  grow = true,
}: Props) {
  const theme = useTheme();
  const filled = variant === 'primary' || variant === 'secondary';
  const background =
    variant === 'primary' ? theme.accent : variant === 'secondary' ? theme.backgroundElement : null;
  const color =
    variant === 'primary' ? theme.onAccent : variant === 'danger' ? theme.danger : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        filled && styles.filled,
        grow && styles.grow,
        {
          backgroundColor: background ?? 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }} numberOfLines={1}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  filled: {
    minHeight: 50,
    borderRadius: Radius.medium,
  },
  grow: {
    flex: 1,
  },
});
