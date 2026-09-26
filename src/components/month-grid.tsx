import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DayMarks } from '@/lib/calendar';
import { toDateString } from '@/lib/dates';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Props = {
  year: number;
  month: number; // 0-based
  selected: string;
  today: string;
  marks: DayMarks;
  onSelect: (day: string) => void;
};

// A Monday-first month grid. Dots mark days with wears (solid) or plans (outline).
export function MonthGrid({ year, month, selected, today, marks, onSelect }: Props) {
  const theme = useTheme();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      toDateString(new Date(year, month, index + 1)),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((label, index) => (
          <ThemedText key={index} type="small" themeColor="textSecondary" style={styles.weekday}>
            {label}
          </ThemedText>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
          const isSelected = day === selected;
          const mark = marks[day];
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={day}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(day)}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: theme.text },
                  !isSelected && day === today && { borderWidth: 1, borderColor: theme.text },
                ]}>
                <ThemedText
                  type="small"
                  style={{ color: isSelected ? theme.background : theme.text }}>
                  {Number(day.slice(8))}
                </ThemedText>
              </View>
              <View style={styles.dots}>
                {mark?.worn && <View style={[styles.dot, { backgroundColor: theme.text }]} />}
                {mark?.planned && (
                  <View style={[styles.dot, { borderColor: theme.text, borderWidth: 1 }]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  day: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
