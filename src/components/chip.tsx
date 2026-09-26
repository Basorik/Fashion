import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

type Props = {
  label: string;
  selected?: boolean;
  // Without onPress the chip is a plain label, like an item's tags.
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox';
};

// A pill used for filters, tag choices and tag labels.
export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
}: Props) {
  const theme = useTheme();
  const style = [styles.chip, { backgroundColor: selected ? theme.text : theme.backgroundElement }];
  const text = (
    <ThemedText type="small" style={{ color: selected ? theme.background : theme.text }}>
      {label}
    </ThemedText>
  );

  if (!onPress) return <View style={style}>{text}</View>;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityRole === 'checkbox' ? { checked: selected } : { selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      hitSlop={4}
      style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}>
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
});
