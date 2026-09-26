import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { Button } from '@/components/button';
import { CategoryChips } from '@/components/category-chips';
import { FooterBar } from '@/components/footer-bar';
import { PhotoChoices } from '@/components/photo-choices';
import { TagPicker } from '@/components/tag-picker';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Category } from '@/constants/categories';
import type { Tag } from '@/constants/tags';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { lookupBarcode } from '@/lib/barcode';
import { successFeedback } from '@/lib/haptics';
import { extractLink, importFromLink } from '@/lib/link-import';
import { inferCategory, inferTags, mergeTags, type ProductText } from '@/lib/tag-inference';
import { parseDateString } from '@/lib/dates';
import { addItem, getItem, listItemTags, today, updateItem } from '@/lib/db';
import { parsePrice } from '@/lib/money';
import { canRemoveBackground, removeBackground } from '@/lib/photo-ai';
import { photoColorTags } from '@/lib/photo-colors';
import { deletePhoto, isCutout, photoUri, savePhoto } from '@/lib/photos';
import { addWish, getWish, listWishTags, updateWish } from '@/lib/wishlist';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: true,
  aspect: [4, 5],
  quality: 0.8,
};

// A photo is either already stored for this item, or newly picked (a local
// file or a product image URL) and not saved until the form is saved. A new
// cut-out keeps the photo it came from, so it can be undone.
type PhotoSource = { stored: string } | { uri: string };
type PhotoState = PhotoSource | { cutout: string; original: PhotoSource } | null;

function displayUri(photo: NonNullable<PhotoState>) {
  if ('stored' in photo) return photoUri(photo.stored);
  return 'cutout' in photo ? photo.cutout : photo.uri;
}

// The picked (not yet stored) photo, or the one a new cut-out was made from.
function shopPhotoUri(photo: PhotoState) {
  const source = photo && 'cutout' in photo ? photo.original : photo;
  return source && 'uri' in source ? source.uri : null;
}

function showsCutout(photo: PhotoState) {
  return photo !== null && ('cutout' in photo || ('stored' in photo && isCutout(photo.stored)));
}

const cutoutProblems = {
  unavailable: null,
  'no-subject': "Couldn't pick out the item in this photo, so it keeps its background.",
  'model-downloading':
    'The background remover is still downloading to this phone. Try again in a minute.',
  failed: "Couldn't remove the background from this photo.",
};

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
  const [notes, setNotes] = useState('');
  const [store, setStore] = useState('');
  const [purchasedOn, setPurchasedOn] = useState('');
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  // Product photos from the last link or barcode lookup, to pick the item's photo from.
  const [photoChoices, setPhotoChoices] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [cuttingOut, setCuttingOut] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [saving, runSave] = useBusy();

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
        if ('barcode' in entry) {
          setBarcode(entry.barcode);
          setNotes(entry.notes ?? '');
          setStore(entry.store ?? '');
          setPurchasedOn(entry.purchasedOn ?? '');
        }
        if ('url' in entry) setUrl(entry.url ?? '');
        setTags(entryTags);
      }
      setLoaded(true);
    });
  }, [db, editingId, isWish]);

  // Fills empty fields from a looked-up product and adds tags matched from its
  // details. Returns a note like ", with 4 tags" for the status message.
  function applyProductDetails(product: ProductText & { brand: string | null; images: string[] }) {
    if (product.name) setName((current) => current || product.name!);
    if (product.brand) setBrand((current) => current || product.brand!);
    const [firstImage] = product.images;
    if (firstImage) setPhoto((current) => current ?? { uri: firstImage });
    setPhotoChoices(product.images.length > 1 ? product.images : []);
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
    const pick = product.images.length > 1 ? ' Pick a different photo above if you like.' : '';
    setLookupMessage(`Filled in from the link${added}. Check the details before saving.${pick}`);
  }

  // Replaces the shown photo with a cut-out of the item, unless another photo
  // was picked in the meantime. Returns the cut-out's URI, or null.
  async function cutOut(source: PhotoSource): Promise<string | null> {
    const sourceUri = displayUri(source);
    setCuttingOut(true);
    setPhotoMessage(null);
    const result = await removeBackground(sourceUri);
    setCuttingOut(false);
    if (!result.ok) {
      setPhotoMessage(cutoutProblems[result.reason]);
      return null;
    }
    setPhoto((current) =>
      current && displayUri(current) === sourceUri
        ? { cutout: result.uri, original: source }
        : current,
    );
    return result.uri;
  }

  // Sets a new photo, cuts the item out of it where the phone can, and tags its
  // main colors and their color seasons, for whichever of the two the item
  // doesn't have yet. Colors are read from the cut-out when there is one, so
  // the background doesn't count.
  async function applyPhoto(uri: string) {
    setPhoto({ uri });
    setPhotoMessage(null);
    const wanted = new Set<Tag['group']>(
      (['Color', 'Color season'] as const).filter(
        (group) => !tags.some((tag) => tag.group === group),
      ),
    );
    const cutoutUri = canRemoveBackground ? await cutOut({ uri }) : null;
    if (wanted.size === 0) return;
    const found = (await photoColorTags(cutoutUri ?? uri, { cutout: cutoutUri !== null })).filter(
      (tag) => wanted.has(tag.group),
    );
    if (found.length === 0) return;
    setTags((current) =>
      mergeTags(
        current,
        found.filter((tag) => !current.some((other) => other.group === tag.group)),
      ),
    );
    const colors = found.filter((tag) => tag.group === 'Color').map((tag) => tag.value);
    const seasons = found.filter((tag) => tag.group === 'Color season').map((tag) => tag.value);
    const described = [
      colors.length > 0 ? listWords(colors.map((color) => color.toLowerCase())) : null,
      seasons.length > 0 ? `color season ${listWords(seasons)}` : null,
    ].filter(Boolean);
    setLookupMessage(
      `Tagged ${described.join(', ')} from the photo. Change it below if it's wrong.`,
    );
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph items.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled) applyPhoto(result.assets[0].uri);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled) applyPhoto(result.assets[0].uri);
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

  const parsedPrice = price.trim() === '' ? null : parsePrice(price);
  const priceIsValid = price.trim() === '' || parsedPrice !== null;
  const parsedPurchasedOn = purchasedOn.trim() === '' ? null : parseDateString(purchasedOn);
  const purchasedOnIsValid = purchasedOn.trim() === '' || parsedPurchasedOn !== null;
  const canSave = loaded && name.trim() !== '' && priceIsValid && purchasedOnIsValid;

  function save() {
    if (!canSave) return;
    runSave(async () => {
      const storedPhoto =
        photo === null
          ? null
          : 'stored' in photo
            ? photo.stored
            : 'cutout' in photo
              ? await savePhoto(photo.cutout, { cutout: true })
              : await savePhoto(photo.uri);
      const common = {
        name: name.trim(),
        category,
        brand: brand.trim() || null,
        price: parsedPrice,
        photo: storedPhoto,
        tags,
      };
      try {
        if (isWish) {
          const wish = { ...common, url: extractLink(url) };
          if (editingId === null) await addWish(db, wish);
          else await updateWish(db, editingId, wish);
        } else {
          const item = {
            ...common,
            barcode,
            notes: notes.trim() || null,
            store: store.trim() || null,
            purchasedOn: parsedPurchasedOn,
          };
          if (editingId === null) await addItem(db, item);
          else await updateItem(db, editingId, item);
        }
      } catch (error) {
        // Don't leave a copied photo behind for an item that wasn't saved.
        if (storedPhoto && storedPhoto !== originalPhoto) deletePhoto(storedPhoto);
        throw error;
      }
      if (originalPhoto && originalPhoto !== storedPhoto) deletePhoto(originalPhoto);
      successFeedback();
      router.back();
    }, 'Could not save');
  }

  const previewUri = photo === null ? null : displayUri(photo);
  const cutoutShown = showsCutout(photo);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: `${editingId === null ? 'Add' : 'Edit'} ${isWish ? 'wishlist item' : 'item'}`,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        {previewUri ? (
          <View style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
            <Image
              source={{ uri: previewUri }}
              style={cutoutShown ? styles.cutout : StyleSheet.absoluteFill}
              contentFit={cutoutShown ? 'contain' : 'cover'}
              transition={150}
              accessibilityLabel={cutoutShown ? 'Item photo, background removed' : 'Item photo'}
            />
            {cuttingOut && (
              <View style={[styles.cuttingOut, { backgroundColor: theme.background }]}>
                <ActivityIndicator />
                <ThemedText type="small" themeColor="textSecondary">
                  Removing background…
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.preview,
              styles.placeholder,
              { backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText themeColor="textSecondary">No photo yet (optional)</ThemedText>
          </View>
        )}
        {photoChoices.length > 0 && (
          <PhotoChoices
            uris={photoChoices}
            selected={shopPhotoUri(photo)}
            onSelect={(uri) => setPhoto({ uri })}
          />
        )}
        <View style={styles.row}>
          <Button label="Take photo" onPress={takePhoto} />
          <Button label="Library" onPress={choosePhoto} />
          {photo && (
            <Button label="Remove" onPress={() => setPhoto(null)} grow={false} variant="plain" />
          )}
        </View>
        {photo && 'cutout' in photo && (
          <Button
            label="Keep the original background"
            onPress={() => setPhoto(photo.original)}
            variant="plain"
          />
        )}
        {photo && canRemoveBackground && !cutoutShown && (
          <Button
            label="Remove background"
            onPress={() => cutOut(photo as PhotoSource)}
            busy={cuttingOut}
            variant="secondary"
          />
        )}
        {photoMessage && (
          <ThemedText type="small" themeColor="textSecondary">
            {photoMessage}
          </ThemedText>
        )}

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="caption" themeColor="textSecondary">
            Fill in from
          </ThemedText>
          <View style={styles.row}>
            <TextField
              value={url}
              onChangeText={setUrl}
              placeholder="Paste a product link"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => url.trim() && !importing && importLink()}
              style={[styles.flex, { backgroundColor: theme.background }]}
            />
            <Button
              label="Import"
              onPress={importLink}
              busy={importing}
              disabled={!url.trim()}
              grow={false}
              variant="primary"
            />
          </View>
          {!isWish && (
            <Button
              label={barcode ? 'Scan another barcode' : 'Scan a barcode'}
              onPress={() => setScanning(true)}
              variant="plain"
            />
          )}
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
        </View>

        <Field label="Name">
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="e.g. White linen shirt"
            autoCapitalize="sentences"
            returnKeyType="done"
          />
        </Field>

        <Field label="Category">
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
        </Field>

        <Field label="Tags">
          <TagPicker value={tags} onChange={setTags} />
        </Field>

        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Brand">
              <TextField value={brand} onChangeText={setBrand} placeholder="Optional" />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="Price">
              <TextField
                value={price}
                onChangeText={setPrice}
                placeholder={isWish ? 'Optional' : 'For cost per wear'}
                keyboardType="decimal-pad"
              />
            </Field>
          </View>
        </View>
        {!priceIsValid && (
          <ThemedText type="small" themeColor="danger">
            Enter a number, like 49.99
          </ThemedText>
        )}

        {!isWish && (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field label="Bought at">
                  <TextField value={store} onChangeText={setStore} placeholder="Optional" />
                </Field>
              </View>
              <View style={styles.flex}>
                <Field label="Bought on">
                  <TextField
                    value={purchasedOn}
                    onChangeText={setPurchasedOn}
                    placeholder="YYYY-MM-DD"
                    keyboardType="numbers-and-punctuation"
                    autoCorrect={false}
                  />
                </Field>
              </View>
            </View>
            {!purchasedOnIsValid && (
              <ThemedText type="small" themeColor="danger">
                Enter a past date like {today()}
              </ThemedText>
            )}
            <Field label="Notes">
              <TextField
                value={notes}
                onChangeText={setNotes}
                placeholder="Sizing, care, repairs…"
                multiline
                textAlignVertical="top"
                style={styles.notes}
              />
            </Field>
          </>
        )}

        {barcode && (
          <ThemedText type="small" themeColor="textSecondary">
            Barcode {barcode}
          </ThemedText>
        )}
      </ScrollView>
      <FooterBar>
        <Button
          label={
            editingId !== null ? 'Save changes' : isWish ? 'Add to wishlist' : 'Add to wardrobe'
          }
          onPress={save}
          busy={saving}
          disabled={!canSave}
          variant="primary"
        />
      </FooterBar>
      <BarcodeScanner
        visible={scanning}
        onScanned={handleScanned}
        onClose={() => setScanning(false)}
      />
    </ThemedView>
  );
}

// "a", "a and b", "a, b and c"
function listWords(words: string[]) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutout: {
    flex: 1,
    margin: Spacing.four,
  },
  cuttingOut: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.large,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  lookup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.two,
  },
  chips: {
    marginHorizontal: -Spacing.three,
    marginVertical: -Spacing.two,
  },
  notes: {
    minHeight: 96,
  },
});
