import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { Button } from '@/components/button';
import { CategoryChips } from '@/components/category-chips';
import { TagPicker } from '@/components/tag-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lookupBarcode } from '@/lib/barcode';
import { extractLink, importFromLink } from '@/lib/link-import';
import { inferCategory, inferTags, mergeTags, type ProductText } from '@/lib/tag-inference';
import { addItem, getItem, listItemTags, updateItem } from '@/lib/db';
import { deletePhoto, photoUri, savePhoto } from '@/lib/photos';
import { addWish, getWish, listWishTags, updateWish } from '@/lib/wishlist';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: true,
  aspect: [4, 5],
  quality: 0.8,
};

// A photo is either already stored for this item, or newly picked (a local
// file or a product image URL) and not saved until the form is saved.
type PhotoState = { stored: string } | { uri: string } | null;

// Adds or edits a wardrobe item (`id`), or a wishlist entry (`list=wish`, `wishId`).
export default function ItemFormScreen() {
  const params = useLocalSearchParams<{ id?: string; wishId?: string; list?: 'wish' }>();
  const isWish = params.list === 'wish' || params.wishId !== undefined;
  const rawId = isWish ? params.wishId : params.id;
  const editingId = rawId ? Number(rawId) : null;
  const db = useSQLiteContext();
  const theme = useTheme();

  const [loaded, setLoaded] = useState(editingId === null);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoState>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Tops');
  // Once the user picks a category themselves, lookups stop changing it.
  const [categoryTouched, setCategoryTouched] = useState(editingId !== null);
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [barcode, setBarcode] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingId === null) return;
    const load = isWish
      ? Promise.all([getWish(db, editingId), listWishTags(db, editingId)])
      : Promise.all([getItem(db, editingId), listItemTags(db, editingId)]);
    load.then(([entry, entryTags]) => {
      if (entry) {
        setOriginalPhoto(entry.photo);
        setPhoto(entry.photo ? { stored: entry.photo } : null);
        setName(entry.name);
        setCategory(entry.category);
        setBrand(entry.brand ?? '');
        setPrice(entry.price === null ? '' : String(entry.price));
        if ('barcode' in entry) setBarcode(entry.barcode);
        if ('url' in entry) setUrl(entry.url ?? '');
        setTags(entryTags);
      }
      setLoaded(true);
    });
  }, [db, editingId, isWish]);

  // Fills empty fields from a looked-up product and adds tags matched from its
  // details. Returns a note like ", with 4 tags" for the status message.
  function applyProductDetails(
    product: ProductText & { brand: string | null; imageUrl: string | null },
  ) {
    if (product.name) setName((current) => current || product.name!);
    if (product.brand) setBrand((current) => current || product.brand!);
    if (product.imageUrl) {
      const imageUrl = product.imageUrl;
      setPhoto((current) => current ?? { uri: imageUrl });
    }
    const inferredCategory = inferCategory(product);
    if (inferredCategory && !categoryTouched) setCategory(inferredCategory);
    const suggested = inferTags(product);
    const newTags = mergeTags(tags, suggested).length - tags.length;
    setTags((current) => mergeTags(current, suggested));
    return newTags > 0 ? `, with ${newTags} tag${newTags === 1 ? '' : 's'}` : '';
  }

  async function importLink() {
    setImporting(true);
    setLookupMessage(null);
    const result = await importFromLink(url);
    setImporting(false);
    if (!result.ok) {
      setLookupMessage(
        {
          'no-link': "That doesn't look like a link. Paste the product page's address.",
          blocked:
            'This shop blocks apps from reading its pages. Fill the details in below, or save the product photo and add it from your library.',
          'no-data': "Couldn't find product details on that page. Fill them in below.",
          network: "Couldn't open that link. Check your connection and try again.",
        }[result.reason],
      );
      return;
    }
    const { product } = result;
    const link = extractLink(url);
    if (link) setUrl(link);
    if (product.price !== null) setPrice((current) => current || String(product.price));
    const added = applyProductDetails(product);
    setLookupMessage(`Filled in from the link${added}. Check the details before saving.`);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph items.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled) setPhoto({ uri: result.assets[0].uri });
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled) setPhoto({ uri: result.assets[0].uri });
  }

  async function handleScanned(code: string) {
    setScanning(false);
    setBarcode(code);
    setLookingUp(true);
    setLookupMessage(null);
    const product = await lookupBarcode(code);
    setLookingUp(false);
    if (!product) {
      setLookupMessage('No product details found for this barcode. Fill them in below.');
      return;
    }
    const added = applyProductDetails(product);
    setLookupMessage(`Filled in from the barcode${added}. Check the details before saving.`);
  }

  const parsedPrice = price.trim() === '' ? null : Number(price.replace(',', '.'));
  const priceIsValid = parsedPrice === null || (Number.isFinite(parsedPrice) && parsedPrice >= 0);
  const canSave = loaded && name.trim() !== '' && priceIsValid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const storedPhoto =
        photo === null ? null : 'stored' in photo ? photo.stored : await savePhoto(photo.uri);
      const common = {
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        price: parsedPrice,
        photo: storedPhoto,
        tags,
      };
      if (isWish) {
        const wish = { ...common, url: extractLink(url) };
        if (editingId === null) await addWish(db, wish);
        else await updateWish(db, editingId, wish);
      } else {
        const item = { ...common, barcode };
        if (editingId === null) await addItem(db, item);
        else await updateItem(db, editingId, item);
      }
      if (originalPhoto && originalPhoto !== storedPhoto) deletePhoto(originalPhoto);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save item', String(error));
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];
  const previewUri = photo === null ? null : 'stored' in photo ? photoUri(photo.stored) : photo.uri;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: `${editingId === null ? 'Add' : 'Edit'} ${isWish ? 'wishlist item' : 'item'}`,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View
            style={[
              styles.preview,
              styles.placeholder,
              { backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText themeColor="textSecondary">No photo (optional)</ThemedText>
          </View>
        )}
        <View style={styles.row}>
          <Button label="Take photo" onPress={takePhoto} />
          <Button label="Library" onPress={choosePhoto} />
          {photo && <Button label="Remove" onPress={() => setPhoto(null)} />}
        </View>
        {!isWish && (
          <View style={styles.row}>
            <Button
              label={barcode ? 'Scan again' : 'Scan barcode'}
              onPress={() => setScanning(true)}
            />
          </View>
        )}
        <View style={styles.linkRow}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Paste a product link"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[inputStyle, styles.linkInput]}
          />
          <View style={styles.linkButton}>
            <Button
              label={importing ? '…' : 'Import'}
              onPress={importLink}
              disabled={importing || !url.trim()}
            />
          </View>
        </View>
        {lookingUp && (
          <View style={styles.lookup}>
            <ActivityIndicator />
            <ThemedText type="small" themeColor="textSecondary">
              Looking up barcode {barcode}…
            </ThemedText>
          </View>
        )}
        {!lookingUp && lookupMessage && (
          <ThemedText type="small" themeColor="textSecondary">
            {lookupMessage}
          </ThemedText>
        )}

        <ThemedText type="smallBold" style={styles.label}>
          Name
        </ThemedText>
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
            onSelect={(value) => {
              if (!value) return;
              setCategory(value);
              setCategoryTouched(true);
            }}
            allowAll={false}
          />
        </View>

        <ThemedText type="smallBold">Tags</ThemedText>
        <TagPicker value={tags} onChange={setTags} />

        <ThemedText type="smallBold">Brand (optional)</ThemedText>
        <TextInput
          value={brand}
          onChangeText={setBrand}
          placeholder="e.g. Uniqlo"
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

        {barcode && (
          <ThemedText type="small" themeColor="textSecondary">
            Barcode {barcode}
          </ThemedText>
        )}

        <View style={styles.row}>
          <Button
            label={
              saving
                ? 'Saving…'
                : editingId === null
                  ? isWish
                    ? 'Add to wishlist'
                    : 'Save item'
                  : 'Save changes'
            }
            onPress={save}
            disabled={!canSave}
            primary
          />
        </View>
      </ScrollView>
      <BarcodeScanner
        visible={scanning}
        onScanned={handleScanned}
        onClose={() => setScanning(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  lookup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkInput: {
    flex: 1,
    marginBottom: 0,
  },
  linkButton: {
    width: 96,
    flexDirection: 'row',
    marginTop: -Spacing.two,
  },
  label: {
    marginTop: Spacing.three,
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
});
