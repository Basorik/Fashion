import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The "+" shown in a screen header.
export function AddButton({ href, label }: { href: Href; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={12}
        style={styles.button}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          tintColor={theme.accent}
          size={24}
          weight="semibold"
        />
      </Pressable>
    </Link>
  );
}

// A text action in a screen header, like "Edit".
export function HeaderTextButton({ href, label }: { href: Href; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={12}
        style={styles.button}>
        <ThemedText style={{ color: theme.accent }}>{label}</ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.three,
  },
});
