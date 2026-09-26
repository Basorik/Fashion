import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HeaderTextButton } from '@/components/add-button';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ItemPhoto } from '@/components/item-photo';
import { Stat } from '@/components/stat';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ItemStatuses, statusLabel, type ItemStatus } from '@/constants/item-status';
import type { Tag } from '@/constants/tags';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { daysBetween, formatDate, formatDay, formatRelativeDay } from '@/lib/dates';
import {
  deleteItem,
  getItem,
  listItemTags,
  listWornWith,
  logWear,
  restoreItem,
  setItemArchived,
  setItemStatus,
  today,
  undoWear,
  type ItemWithStats,
} from '@/lib/db';
import { formatPrice } from '@/lib/money';
import { successFeedback, tapFeedback, warningFeedback } from '@/lib/haptics';
import { deletePhoto, photoUri } from '@/lib/photos';
import { canShare, shareFile } from '@/lib/share';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const [item, setItem] = useState<ItemWithStats | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [wornWith, setWornWith] = useState<Awaited<ReturnType<typeof listWornWith>>>([]);
  const [busy, run] = useBusy();
  const [lentTo, setLentTo] = useState('');

  const load = useCallback(() => {
    getItem(db, itemId).then((loaded) => {
      setItem(loaded);
      setLentTo(loaded?.lentTo ?? '');
    });
    listWornWith(db, itemId).then(setWornWith);
    listItemTags(db, itemId).then(setTags);
  }, [db, itemId]);

  useFocusEffect(load);

  if (!item) {
    return <ThemedView style={styles.container} />;
  }

  const current = item;
  const now = today();
  const woreToday = current.lastWorn === now;
  const costPerWear =
    current.price !== null && current.wearCount > 0 ? current.price / current.wearCount : null;

  function toggleWear() {
    run(async () => {
      if (woreToday) {
        await undoWear(db, current.id);
        tapFeedback();
      } else {
        await logWear(db, current.id);
        successFeedback();
      }
      load();
    });
  }

  function restore() {
    run(async () => {
      await restoreItem(db, current.id);
      load();
    });
  }

  function changeStatus(status: ItemStatus | null) {
    run(async () => {
      await setItemStatus(db, current.id, status, lentTo.trim() || null);
      load();
    });
  }

  function saveLentTo() {
    if (current.status !== 'lent' || (current.lentTo ?? '') === lentTo.trim()) return;
    changeStatus('lent');
  }

  function toggleArchived() {
    run(async () => {
      await setItemArchived(db, current.id, current.archivedAt === null);
      load();
    });
  }

  const bought = [
    current.store && `Bought at ${current.store}`,
    current.purchasedOn &&
      `${current.store ? 'on' : 'Bought on'} ${formatDate(current.purchasedOn)} (${formatAge(daysBetween(current.purchasedOn, now))})`,
  ]
    .filter(Boolean)
    .join(' ');

  function sharePhoto() {
    if (!current.photo) return;
    const photo = current.photo;
    run(
      () =>
        shareFile(photoUri(photo), {
          mimeType: photoMimeType(photo),
          dialogTitle: `Share ${current.name}`,
        }),
      'Could not share photo',
    );
  }

  function confirmDelete() {
    warningFeedback();
    Alert.alert('Delete for good?', `${current.name} and its wear history will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await deleteItem(db, current.id);
            if (current.photo) deletePhoto(current.photo);
            router.back();
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <HeaderTextButton
              href={{ pathname: '/add-item', params: { id: current.id } }}
              label="Edit"
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ItemPhoto photo={current.photo} name={current.name} style={styles.photo} />
        {canShare && current.photo && (
          <Button label="Share photo" onPress={sharePhoto} variant="plain" disabled={busy} />
        )}

        <View style={styles.heading}>
          <ThemedText type="caption" themeColor="textSecondary">
            {[current.category, current.brand].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="title">{current.name}</ThemedText>
          {current.archivedAt && (
            <ThemedText type="small" themeColor="textSecondary">
              {`Archived on ${formatDate(current.archivedAt)}. It's hidden from your wardrobe and suggestions.`}
            </ThemedText>
          )}
        </View>

        {current.removedOn && (
          <View style={[styles.removed, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">
              Removed {formatDay(current.removedOn)}
              {current.removedReason ? ` · ${current.removedReason}` : ''}
            </ThemedText>
            {current.removedNote && (
              <ThemedText type="small" themeColor="textSecondary">
                {current.removedNote}
              </ThemedText>
            )}
          </View>
        )}

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Chip
                key={`${tag.group}:${tag.value}`}
                label={tag.group === 'Color season' ? `${tag.value} palette` : tag.value}
              />
            ))}
          </View>
        )}

        <View style={styles.stats}>
          <Stat label="Times worn" value={String(current.wearCount)} />
          <Stat
            label="Last worn"
            value={current.lastWorn ? formatRelativeDay(current.lastWorn, now) : 'Never'}
          />
          <Stat
            label={costPerWear === null ? 'Price' : 'Cost per wear'}
            value={
              costPerWear !== null
                ? formatPrice(costPerWear)
                : current.price !== null
                  ? formatPrice(current.price)
                  : '—'
            }
          />
        </View>

        <View style={styles.row}>
          {current.removedOn ? (
            <Button label="Put back in wardrobe" onPress={restore} busy={busy} />
          ) : (
            <Button
              label={woreToday ? 'Worn today · Undo' : 'I wore this today'}
              onPress={toggleWear}
              busy={busy}
              variant={woreToday ? 'secondary' : 'primary'}
            />
          )}
        </View>

        {!current.removedOn && (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              Where is it
            </ThemedText>
            <View style={styles.tags}>
              <Chip
                label="In wardrobe"
                selected={current.status === null}
                onPress={() => changeStatus(null)}
              />
              {ItemStatuses.map((status) => (
                <Chip
                  key={status}
                  label={statusLabel(status)}
                  selected={current.status === status}
                  onPress={() => changeStatus(status)}
                />
              ))}
            </View>
            {current.status === 'lent' && (
              <TextField
                value={lentTo}
                onChangeText={setLentTo}
                onEndEditing={saveLentTo}
                placeholder="Lent to whom? (optional)"
                autoCapitalize="words"
                returnKeyType="done"
              />
            )}
          </View>
        )}

        {(current.notes || bought) && (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              Details
            </ThemedText>
            {bought ? <ThemedText>{bought}</ThemedText> : null}
            {current.notes ? <ThemedText>{current.notes}</ThemedText> : null}
          </View>
        )}

        {wornWith.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              Most often worn with
            </ThemedText>
            <View style={styles.pairs}>
              {wornWith.map((other) => (
                <Link
                  key={other.id}
                  href={{ pathname: '/item/[id]', params: { id: other.id } }}
                  asChild>
                  <Pressable accessibilityLabel={other.name} style={styles.pair}>
                    <ItemPhoto photo={other.photo} name={other.name} style={styles.pairPhoto} />
                    <ThemedText type="small" numberOfLines={1}>
                      {other.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {other.times}× together
                    </ThemedText>
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        )}

        {current.removedOn ? (
          <Button label="Delete for good" onPress={confirmDelete} variant="danger" />
        ) : (
          <View style={styles.row}>
            <Button
              label={current.archivedAt ? 'Unarchive' : 'Archive'}
              onPress={toggleArchived}
              variant="plain"
            />
            <Button
              label="Remove from wardrobe"
              onPress={() => router.push({ pathname: '/remove-item', params: { id: current.id } })}
              variant="danger"
            />
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

// "3 weeks old", "5 months old", "2 years old"
function formatAge(days: number) {
  if (days < 1) return 'new today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`;
  if (days < 61) return `${Math.round(days / 7)} weeks old`;
  if (days < 730) return `${Math.round(days / 30.4)} months old`;
  return `${Math.floor(days / 365.25)} years old`;
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
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.large,
  },
  heading: {
    gap: Spacing.one,
  },
  removed: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  pairs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pair: {
    flex: 1,
    maxWidth: '33%',
  },
  pairPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.medium,
    marginBottom: Spacing.one,
  },
});

function photoMimeType(name: string) {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (extension === 'png' || extension === 'webp' || extension === 'heic')
    return `image/${extension}`;
  return 'image/jpeg';
}
