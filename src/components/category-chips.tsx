import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Categories, type Category } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  selected: Category | undefined;
  onSelect: (category: Category | undefined) => void;
  // When false, the "All" chip is hidden and one category is always selected.
  allowAll?: boolean;
};

export function CategoryChips({ selected, onSelect, allowAll = true }: Props) {
  const theme = useTheme();
  const options: (Category | undefined)[] = allowAll ? [undefined, ...Categories] : [...Categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {options.map((category) => {
        const active = category === selected;
        return (
          <Pressable
            key={category ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(category)}
            style={[
              styles.chip,
              { backgroundColor: active ? theme.text : theme.backgroundElement },
            ]}>
            <ThemedText type="small" style={{ color: active ? theme.background : theme.text }}>
              {category ?? 'All'}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
