import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  uris: string[];
  // The photo currently used for the item, highlighted when it's one of these.
  selected: string | null;
  onSelect: (uri: string) => void;
};

// A row of product photos found by an import, to choose the item's photo from.
export function PhotoChoices({ uris, selected, onSelect }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <ThemedText type="caption" themeColor="textSecondary">
        {uris.length} product photos · tap one to use it
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroller}>
        {uris.map((uri, index) => {
          const isSelected = uri === selected;
          return (
            <Pressable
              key={uri}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              accessibilityLabel={`Shop photo ${index + 1} of ${uris.length}`}
              onPress={() => onSelect(uri)}
              style={({ pressed }) => [
                styles.thumb,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                recyclingKey={uri}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  scroller: {
    marginHorizontal: -Spacing.three,
  },
  row: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  thumb: {
    width: 72,
    aspectRatio: 4 / 5,
    borderRadius: Radius.medium,
    borderWidth: 2,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    borderRadius: Radius.medium - 2,
  },
});
