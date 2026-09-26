import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ItemPhoto } from '@/components/item-photo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ColorSeasonInfo, ColorSeasons, type ColorSeason } from '@/constants/color-seasons';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import {
  getColorSeasonOverview,
  listItemsInColorSeason,
  setMySeason,
  tagColorSeasonsFromPhotos,
  type ColorSeasonOverview,
} from '@/lib/color-seasons';
import type { ItemWithStats } from '@/lib/db';

// Pick your own color season and see which of your clothes are in its shades.
export default function ColorSeasonScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [overview, setOverview] = useState<ColorSeasonOverview | null>(null);
  const [matches, setMatches] = useState<ItemWithStats[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [tagging, run] = useBusy();

  const load = useCallback(async () => {
    const next = await getColorSeasonOverview(db);
    setOverview(next);
    setMatches(next.mine ? await listItemsInColorSeason(db, next.mine) : []);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function choose(season: ColorSeason) {
    await setMySeason(db, overview?.mine === season ? null : season);
    load();
  }

  function tagFromPhotos() {
    run(async () => {
      const tagged = await tagColorSeasonsFromPhotos(db);
      setMessage(
        tagged === 0
          ? "Couldn't read colors from those photos. You can set color seasons when editing items."
          : `Tagged ${tagged} item${tagged === 1 ? '' : 's'}. Check any that look wrong when editing them.`,
      );
      await load();
    });
  }

  if (!overview) return <ThemedView style={styles.container} />;
  const { mine, counts, untagged } = overview;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary">
          Color analysis puts people and shades into four seasons by undertone (warm or cool), depth
          and brightness. Pick your season to see which of your clothes suit your coloring.
        </ThemedText>

        {ColorSeasons.map((season) => {
          const selected = mine === season;
          return (
            <Pressable
              key={season}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${season}: ${ColorSeasonInfo[season].description}`}
              onPress={() => choose(season)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: selected ? theme.accent : 'transparent',
                },
                pressed && styles.pressed,
              ]}>
              <View style={styles.cardHeading}>
                <ThemedText type="subtitle">{season}</ThemedText>
                <ThemedText
                  type="smallBold"
                  style={selected ? { color: theme.accent } : undefined}
                  themeColor="textSecondary">
                  {selected
                    ? 'Your season'
                    : `${counts[season]} item${counts[season] === 1 ? '' : 's'}`}
                </ThemedText>
              </View>
              <View style={styles.swatches}>
                {ColorSeasonInfo[season].swatches.map((color) => (
                  <View
                    key={color}
                    style={[styles.swatch, { backgroundColor: color, borderColor: theme.border }]}
                  />
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {ColorSeasonInfo[season].description}
              </ThemedText>
            </Pressable>
          );
        })}

        {untagged > 0 && (
          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary">
              {untagged} item{untagged === 1 ? ' has' : 's have'} a photo but no color season yet.
            </ThemedText>
            <View style={styles.row}>
              <Button label="Work them out from photos" onPress={tagFromPhotos} busy={tagging} />
            </View>
          </View>
        )}
        {message && (
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        )}

        {mine && (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              In your {mine.toLowerCase()} shades ({matches.length})
            </ThemedText>
            {matches.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing tagged {mine} yet. Items get a color season from their photo, or you can
                pick one when editing an item.
              </ThemedText>
            ) : (
              <View style={styles.grid}>
                {matches.map((item) => (
                  <Link
                    key={item.id}
                    href={{ pathname: '/item/[id]', params: { id: item.id } }}
                    asChild>
                    <Pressable accessibilityLabel={item.name} style={styles.tile}>
                      <ItemPhoto photo={item.photo} name={item.name} style={styles.tilePhoto} />
                      <ThemedText type="small" numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                    </Pressable>
                  </Link>
                ))}
              </View>
            )}
          </View>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          An item&apos;s season is worked out from its main colors on your phone, so treat it as a
          guide.
        </ThemedText>
      </ScrollView>
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
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.large,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.7,
  },
  swatches: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    width: '31%',
  },
  tilePhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.medium,
    marginBottom: Spacing.one,
  },
});
