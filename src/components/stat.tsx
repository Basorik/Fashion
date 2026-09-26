import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.stat, { backgroundColor: theme.backgroundElement }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="subtitle" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
