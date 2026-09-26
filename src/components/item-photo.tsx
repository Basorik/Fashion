import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { photoUri } from '@/lib/photos';

type Props = {
  photo: string | null;
  // Shown in the placeholder when the item has no photo.
  name: string;
  style?: StyleProp<ViewStyle>;
};

export function ItemPhoto({ photo, name, style }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: theme.backgroundElement }, style]}>
      {photo ? (
        <Image source={{ uri: photoUri(photo) }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
});
