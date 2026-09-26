import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FooterBar } from '@/components/footer-bar';
import { ItemPhoto } from '@/components/item-photo';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { formatDay } from '@/lib/dates';
import { addOutfit, today, type ItemWithStats } from '@/lib/db';
import { successFeedback } from '@/lib/haptics';
import {
  loadShufflePool,
  pickFor,
  ShuffleSlots,
  SlotLabels,
  type ShufflePool,
  type ShuffleSlot,
} from '@/lib/shuffle';

type Picks = Partial<Record<ShuffleSlot, ItemWithStats | null>>;

// Slots that can be switched on and off. Tops and bottoms, or a dress, are always in.
const OPTIONAL_SLOTS = ['Outerwear', 'Shoes', 'Accessories'] as const;

function slotsFor(from: ShufflePool, useDress: boolean, useExtras: Set<ShuffleSlot>) {
  return ShuffleSlots.filter((slot) => {
    if (from[slot].length === 0) return false;
    if (slot === 'Dresses') return useDress;
    if (slot === 'Tops' || slot === 'Bottoms') return !useDress;
    return useExtras.has(slot);
  });
}

// Fills slots that have nothing picked yet, keeping what's already there.
function fillPicks(
  picks: Picks,
  from: ShufflePool,
  useDress: boolean,
  useExtras: Set<ShuffleSlot>,
): Picks {
  const next = { ...picks };
  for (const slot of slotsFor(from, useDress, useExtras)) {
    if (!next[slot]) next[slot] = pickFor(from, slot);
  }
  return next;
}

// Deals a random outfit from what's ready to wear. Lock the pieces you like,
// shuffle the rest, and save the result as an outfit.
export default function ShuffleScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [pool, setPool] = useState<ShufflePool | null>(null);
  const [dress, setDress] = useState(false);
  const [extras, setExtras] = useState<Set<ShuffleSlot>>(new Set());
  const [picks, setPicks] = useState<Picks>({});
  const [locked, setLocked] = useState<Set<ShuffleSlot>>(new Set());
  const [name, setName] = useState('');
  const [saving, run] = useBusy();

  useEffect(() => {
    loadShufflePool(db).then((loaded) => {
      const useDress =
        loaded.Dresses.length > 0 && (loaded.Tops.length === 0 || loaded.Bottoms.length === 0);
      const useExtras = new Set<ShuffleSlot>(loaded.Shoes.length > 0 ? ['Shoes'] : []);
      setPool(loaded);
      setDress(useDress);
      setExtras(useExtras);
      setPicks((existing) => fillPicks(existing, loaded, useDress, useExtras));
    });
  }, [db]);

  if (!pool) return <ThemedView style={styles.container} />;
  const current = pool;
  const slots = slotsFor(current, dress, extras);
  const chosen = slots.map((slot) => picks[slot]).filter((item) => item != null);

  function shuffle() {
    setPicks((existing) => {
      const next = { ...existing };
      for (const slot of slots) {
        if (!locked.has(slot)) next[slot] = pickFor(current, slot, existing[slot]);
      }
      return next;
    });
  }

  function reroll(slot: ShuffleSlot) {
    setPicks((existing) => ({ ...existing, [slot]: pickFor(current, slot, existing[slot]) }));
  }

  function toggleLock(slot: ShuffleSlot) {
    setLocked((existing) => {
      const next = new Set(existing);
      if (!next.delete(slot)) next.add(slot);
      return next;
    });
  }

  function chooseDress(value: boolean) {
    setDress(value);
    setPicks((existing) => fillPicks(existing, current, value, extras));
  }

  function toggleExtra(slot: ShuffleSlot) {
    const next = new Set(extras);
    if (!next.delete(slot)) next.add(slot);
    setExtras(next);
    setPicks((existing) => fillPicks(existing, current, dress, next));
  }

  function save() {
    run(async () => {
      const outfitName = name.trim() || `Shuffle, ${formatDay(today())}`;
      const outfitId = await addOutfit(
        db,
        outfitName,
        chosen.map((item) => item.id),
      );
      successFeedback();
      router.replace({ pathname: '/outfit/[id]', params: { id: outfitId } });
    }, 'Could not save outfit');
  }

  const hasSeparates = current.Tops.length > 0 && current.Bottoms.length > 0;
  const hasDresses = current.Dresses.length > 0;
  const tileWidth = (width - Spacing.three * 2 - Spacing.two) / 2;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.chips}>
          {hasSeparates && (
            <Chip label="Top + bottom" selected={!dress} onPress={() => chooseDress(false)} />
          )}
          {hasDresses && <Chip label="Dress" selected={dress} onPress={() => chooseDress(true)} />}
          {OPTIONAL_SLOTS.filter((slot) => current[slot].length > 0).map((slot) => (
            <Chip
              key={slot}
              label={SlotLabels[slot]}
              selected={extras.has(slot)}
              onPress={() => toggleExtra(slot)}
              accessibilityRole="checkbox"
            />
          ))}
        </View>

        {slots.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Add some tops and bottoms, or a dress, to your wardrobe to shuffle outfits. Items in the
            wash, lent out or archived are left out.
          </ThemedText>
        ) : (
          <View style={styles.grid}>
            {slots.map((slot) => {
              const item = picks[slot];
              const isLocked = locked.has(slot);
              return (
                <View key={slot} style={{ width: tileWidth }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${SlotLabels[slot]}: ${item?.name ?? 'none'}. Tap for another`}
                    onPress={() => reroll(slot)}
                    disabled={isLocked || current[slot].length < 2}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ItemPhoto
                      photo={item?.photo ?? null}
                      name={item?.name ?? SlotLabels[slot]}
                      style={[
                        styles.photo,
                        { borderColor: isLocked ? theme.accent : 'transparent' },
                      ]}
                    />
                  </Pressable>
                  <View style={styles.caption}>
                    <View style={styles.flex}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {SlotLabels[slot]}
                      </ThemedText>
                      <ThemedText type="small" numberOfLines={1}>
                        {item?.name ?? '—'}
                      </ThemedText>
                    </View>
                    <Chip
                      label={isLocked ? 'Locked' : 'Lock'}
                      selected={isLocked}
                      onPress={() => toggleLock(slot)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Keep this ${SlotLabels[slot].toLowerCase()}`}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {chosen.length >= 2 && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Tap a piece to swap just that one, or lock the ones you like and shuffle the rest.
            </ThemedText>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Name it (optional)"
              returnKeyType="done"
            />
          </>
        )}
      </ScrollView>
      <FooterBar>
        <Button
          label="Shuffle"
          onPress={shuffle}
          disabled={slots.every((slot) => locked.has(slot) || current[slot].length < 2)}
        />
        <Button
          label="Save outfit"
          onPress={save}
          busy={saving}
          disabled={chosen.length < 2}
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
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    rowGap: Spacing.three,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.medium,
    borderWidth: 3,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});
