import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Theme } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { DATABASE_NAME, migrate } from '@/lib/db';
import { loadPhotos } from '@/lib/photos';
import '@/lib/web-alert';

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

async function prepare(db: SQLiteDatabase) {
  await migrate(db);
  await loadPhotos();
}

// Opening a screen straight from its web address (a refresh or bookmark) puts
// the tabs underneath it, so its back and close buttons have somewhere to go.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const themes = { light: navigationTheme('light'), dark: navigationTheme('dark') };

if (Platform.OS !== 'web') {
  // Show the wear reminder even when Bella is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Opens the screen a tapped notification points at (the wear reminder opens "Log what you wore").
function useNotificationLinks() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    function open(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    }
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification),
    );
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useNotificationLinks();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? themes.dark : themes.light}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={prepare}>
          <Stack
            screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add-item" options={{ title: 'Add item', presentation: 'modal' }} />
            <Stack.Screen name="item/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="remove-item"
              options={{ title: 'Remove item', presentation: 'modal' }}
            />
            <Stack.Screen name="color-season" options={{ title: 'Color season' }} />
            <Stack.Screen
              name="new-outfit"
              options={{ title: 'New outfit', presentation: 'modal' }}
            />
            <Stack.Screen name="outfit/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="log-wear"
              options={{ title: 'What did you wear?', presentation: 'modal' }}
            />
            <Stack.Screen
              name="shuffle"
              options={{ title: 'Shuffle an outfit', presentation: 'modal' }}
            />
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
            <Stack.Screen name="backup" options={{ title: 'Backup', presentation: 'modal' }} />
          </Stack>
        </SQLiteProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
