import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { photoUri } from '@/lib/photos';

// A 2x2 grid of the outfit's first four item photos.
export function OutfitCollage({ photos, size }: { photos: string[]; size: number }) {
  const theme = useTheme();
  const cell = (size - 2) / 2;
  return (
    <View style={[styles.grid, { width: size, height: size, backgroundColor: theme.backgroundElement }]}>
      {photos.slice(0, 4).map((photo) => (
        <Image
          key={photo}
          source={{ uri: photoUri(photo) }}
          style={{ width: cell, height: cell }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
