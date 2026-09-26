import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { OutfitCollage } from '@/components/outfit-collage';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestOutfits, type Suggestion } from '@/lib/suggestions';
import { formatTemperature, getTodayWeather, type Weather } from '@/lib/weather';

// "Today" card: the local forecast and the best-fitting saved outfits.
export function TodaySuggestions() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [weather, setWeather] = useState<Weather | null | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    getTodayWeather().then(setWeather);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (weather === undefined) return;
      suggestOutfits(db, weather).then(setSuggestions);
    }, [db, weather])
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">What to wear today</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {weather === undefined
          ? 'Checking the weather…'
          : weather === null
            ? 'Weather unavailable. Allow location to get weather-aware picks.'
            : `${weather.description}, ${formatTemperature(weather.current)} now · ` +
              `high ${formatTemperature(weather.high)}, low ${formatTemperature(weather.low)}` +
              (weather.rainChance >= 30 ? ` · ${weather.rainChance}% chance of rain` : '')}
      </ThemedText>
      {weather !== undefined && suggestions.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Save a few outfits to get suggestions.
        </ThemedText>
      )}
      {suggestions.map(({ outfit, reason }) => (
        <Link key={outfit.id} href={{ pathname: '/outfit/[id]', params: { id: outfit.id } }} asChild>
          <Pressable accessibilityLabel={outfit.name} style={styles.row}>
            <OutfitCollage photos={outfit.photos} size={56} />
            <View style={styles.text}>
              <ThemedText type="smallBold">{outfit.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {reason}
              </ThemedText>
            </View>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  text: {
    flex: 1,
  },
});
