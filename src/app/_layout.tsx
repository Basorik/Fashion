import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { DATABASE_NAME, migrate } from '@/lib/db';

// Headers, tab bars and screen backgrounds in Bella's colors.
function navigationTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };
}

const themes = { light: navigationTheme('light'), dark: navigationTheme('dark') };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? themes.dark : themes.light}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
          <Stack
            screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add-item" options={{ title: 'Add item', presentation: 'modal' }} />
            <Stack.Screen name="item/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="new-outfit"
              options={{ title: 'New outfit', presentation: 'modal' }}
            />
            <Stack.Screen name="outfit/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="outfit-board"
              options={{ title: 'Arrange outfit', presentation: 'modal' }}
            />
            <Stack.Screen
              name="pick-outfit"
              options={{ title: 'Pick outfit', presentation: 'modal' }}
            />
            <Stack.Screen
              name="pick-items"
              options={{ title: 'Add items', presentation: 'modal' }}
            />
            <Stack.Screen name="wish/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="new-trip"
              options={{ title: 'New packing list', presentation: 'modal' }}
            />
            <Stack.Screen name="trip/[id]" options={{ title: '' }} />
          </Stack>
        </SQLiteProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
