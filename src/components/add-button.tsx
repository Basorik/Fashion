import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// The "+" shown in a screen header.
export function AddButton({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityLabel={label} hitSlop={12}>
        <ThemedText style={styles.text}>+</ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 28,
    lineHeight: 32,
    paddingHorizontal: Spacing.three,
  },
});
