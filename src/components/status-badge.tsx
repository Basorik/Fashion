import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { statusLabel, type ItemStatus } from '@/constants/item-status';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A small label over an item's photo saying it's in the laundry, lent out, etc.
export function StatusBadge({ status, lentTo }: { status: ItemStatus; lentTo?: string | null }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.text }]}>
      <ThemedText type="small" numberOfLines={1} style={{ color: theme.background }}>
        {statusLabel(status, lentTo)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
    maxWidth: '90%',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    opacity: 0.85,
  },
});
