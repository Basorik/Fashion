import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CategoryChips } from '@/components/category-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addItem } from '@/lib/db';
import { savePhoto } from '@/lib/photos';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: true,
  aspect: [4, 5],
  quality: 0.8,
};

export default function AddItemScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Tops');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph items.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  const parsedPrice = price.trim() === '' ? null : Number(price.replace(',', '.'));
  const priceIsValid = parsedPrice === null || (Number.isFinite(parsedPrice) && parsedPrice >= 0);
  const canSave = photo !== null && name.trim() !== '' && priceIsValid && !saving;

  async function save() {
    if (!canSave || photo === null) return;
    setSaving(true);
    try {
      const storedPhoto = await savePhoto(photo);
      await addItem(db, {
        name: name.trim(),
        category,
        color: color.trim() || null,
        price: parsedPrice,
        photo: storedPhoto,
      });
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save item', String(error));
    }
  }

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {photo ? (
          <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.placeholder, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor="textSecondary">Add a photo of the item</ThemedText>
          </View>
        )}
        <View style={styles.photoButtons}>
          <Button label="Take photo" onPress={takePhoto} />
          <Button label="Choose from library" onPress={choosePhoto} />
        </View>

        <ThemedText type="smallBold">Name</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. White linen shirt"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="smallBold">Category</ThemedText>
        <View style={styles.chips}>
          <CategoryChips
            selected={category}
            onSelect={(value) => value && setCategory(value)}
            allowAll={false}
          />
        </View>

        <ThemedText type="smallBold">Color (optional)</ThemedText>
        <TextInput
          value={color}
          onChangeText={setColor}
          placeholder="e.g. Navy"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="smallBold">Price (optional)</ThemedText>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="Used for cost per wear"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={inputStyle}
        />
        {!priceIsValid && (
          <ThemedText type="small" style={styles.error}>
            Enter a number, like 49.99
          </ThemedText>
        )}

        <Button label={saving ? 'Saving…' : 'Save item'} onPress={save} disabled={!canSave} primary />
      </ScrollView>
    </ThemedView>
  );
}

function Button({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: primary ? theme.text : theme.backgroundElement, opacity: disabled ? 0.4 : 1 },
      ]}>
      <ThemedText type="smallBold" style={{ color: primary ? theme.background : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  chips: {
    marginHorizontal: -Spacing.three,
    marginBottom: Spacing.two,
  },
  error: {
    color: '#D93036',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
});
