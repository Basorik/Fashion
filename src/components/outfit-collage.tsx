import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { photoUri } from '@/lib/photos';

// The outfit's first item photos: one fills the tile, two sit side by side,
// three or four make a 2x2 grid.
export function OutfitCollage({ photos, size }: { photos: string[]; size: number }) {
  const theme = useTheme();
  const shown = photos.slice(0, 4);
  const gap = 2;
  const half = (size - gap) / 2;
  const cellSize = (index: number) => {
    if (shown.length === 1) return { width: size, height: size };
    if (shown.length === 2) return { width: half, height: size };
    // With three photos the first one takes the whole left column.
    if (shown.length === 3 && index === 0) return { width: half, height: size };
    return { width: half, height: half };
  };

  return (
    <View
      style={[
        styles.grid,
        {
          width: size,
          height: size,
          gap,
          backgroundColor: theme.backgroundElement,
          borderRadius: size < 80 ? Radius.small : Radius.medium,
        },
      ]}>
      {shown.length === 0 && size >= 80 && (
        <View style={styles.empty}>
          <ThemedText type="small" themeColor="textSecondary">
            No photos
          </ThemedText>
        </View>
      )}
      {shown.length === 3 ? (
        <>
          <Image source={{ uri: photoUri(shown[0]) }} style={cellSize(0)} contentFit="cover" />
          <View style={{ gap }}>
            {shown.slice(1).map((photo, index) => (
              <Image
                key={`${photo}-${index}`}
                source={{ uri: photoUri(photo) }}
                style={cellSize(index + 1)}
                contentFit="cover"
              />
            ))}
          </View>
        </>
      ) : (
        shown.map((photo, index) => (
          <Image
            key={`${photo}-${index}`}
            source={{ uri: photoUri(photo) }}
            style={cellSize(index)}
            contentFit="cover"
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
