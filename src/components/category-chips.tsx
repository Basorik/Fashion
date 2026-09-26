import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/chip';
import { Categories, type Category } from '@/constants/categories';
import { Spacing } from '@/constants/theme';

type Props = {
  selected: Category | undefined;
  onSelect: (category: Category | undefined) => void;
  // When false, the "All" chip is hidden and one category is always selected.
  allowAll?: boolean;
};

export function CategoryChips({ selected, onSelect, allowAll = true }: Props) {
  const options: (Category | undefined)[] = allowAll ? [undefined, ...Categories] : [...Categories];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {options.map((category) => (
        <Chip
          key={category ?? 'all'}
          label={category ?? 'All'}
          selected={category === selected}
          onPress={() => onSelect(category)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
