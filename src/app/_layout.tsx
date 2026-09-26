import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DATABASE_NAME, migrate } from '@/lib/db';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
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
