import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { isCutout, photoUri } from '@/lib/photos';

type Props = {
  photo: string | null;
  // Shown in the placeholder when the item has no photo.
  name: string;
  style?: StyleProp<ViewStyle>;
  // Drops the backdrop behind cut-outs, for the outfit board.
  bare?: boolean;
};

// Photos fill the frame; cut-outs (items with the background removed) are
// shown whole with a little room around them.
export function ItemPhoto({ photo, name, style, bare = false }: Props) {
  const theme = useTheme();
  const cutout = photo !== null && isCutout(photo);
  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: cutout && bare ? 'transparent' : theme.backgroundElement },
        style,
      ]}>
      {photo ? (
        <Image
          source={{ uri: photoUri(photo) }}
          style={cutout && !bare ? styles.cutout : StyleSheet.absoluteFill}
          contentFit={cutout ? 'contain' : 'cover'}
        />
      ) : (
        <ThemedText type="subtitle" themeColor="textSecondary">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutout: {
    position: 'absolute',
    top: '8%',
    right: '8%',
    bottom: '8%',
    left: '8%',
  },
});
