import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  rows: { label: string; value: number }[];
  format?: (value: number) => string;
};

// A ranked list with a thin single-hue bar per row and the value as a direct label.
export function BarList({ rows, format = String }: Props) {
  const theme = useTheme();
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View
          key={row.label}
          style={styles.row}
          accessible
          accessibilityLabel={`${row.label}: ${format(row.value)}`}>
          <ThemedText type="small" style={styles.label} numberOfLines={1}>
            {row.label}
          </ThemedText>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                { width: `${Math.max((row.value / max) * 100, 2)}%`, backgroundColor: theme.text },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
            {format(row.value)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    width: 90,
  },
  track: {
    flex: 1,
    height: 8,
  },
  bar: {
    height: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  value: {
    width: 56,
    textAlign: 'right',
  },
});
