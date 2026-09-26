import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FooterBar } from '@/components/footer-bar';
import { ItemPhoto } from '@/components/item-photo';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RemovalReasons } from '@/constants/removal';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { deleteItem, getItem, removeItem, type ItemWithStats } from '@/lib/db';
import { warningFeedback } from '@/lib/haptics';
import { deletePhoto } from '@/lib/photos';

// Asks why an item is going, then moves it to the removed list (Lists tab).
export default function RemoveItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const db = useSQLiteContext();
  const [item, setItem] = useState<ItemWithStats | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, run] = useBusy();

  useEffect(() => {
    getItem(db, itemId).then(setItem);
  }, [db, itemId]);

  function remove() {
    if (!reason) return;
    run(async () => {
      await removeItem(db, itemId, reason, note.trim() || null);
      router.back();
    }, 'Could not remove');
  }

  function confirmDelete() {
    if (!item) return;
    const current = item;
    warningFeedback();
    Alert.alert(
      'Delete for good?',
      `${current.name} and its wear history will be deleted, and it won't appear in your removed items.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await deleteItem(db, current.id);
              if (current.photo) deletePhoto(current.photo);
              router.dismissAll();
            }),
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {item && (
          <View style={styles.item}>
            <ItemPhoto photo={item.photo} name={item.name} style={styles.thumb} />
            <View style={styles.flex}>
              <ThemedText type="subtitle" numberOfLines={2}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.wearCount === 0 ? 'Never worn' : `Worn ${item.wearCount}×`}
              </ThemedText>
            </View>
          </View>
        )}

        <ThemedText themeColor="textSecondary">
          It moves to Removed in the Lists tab with its wear history, so you can look back at what
          you&apos;ve let go of, or put it back.
        </ThemedText>

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary">
            Why is it going?
          </ThemedText>
          <View style={styles.chips}>
            {RemovalReasons.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={reason === option}
                onPress={() => setReason(option)}
                accessibilityLabel={`Reason: ${option}`}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary">
            Note (optional)
          </ThemedText>
          <TextField
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Sold on Vinted, shrank in the wash"
            autoCapitalize="sentences"
            multiline
            style={styles.note}
          />
        </View>

        <Button
          label="Added by mistake? Delete it instead"
          onPress={confirmDelete}
          variant="danger"
        />
      </ScrollView>
      <FooterBar>
        <Button
          label="Remove from wardrobe"
          onPress={remove}
          busy={busy}
          disabled={!reason || !item}
          variant="primary"
        />
      </FooterBar>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: Radius.small,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  note: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
