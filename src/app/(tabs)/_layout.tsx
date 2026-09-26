import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router/js-tabs';

import { AddButton } from '@/components/add-button';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wardrobe',
          headerRight: () => <AddButton href="/add-item" label="Add item" />,
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'tshirt', android: 'checkroom', web: 'checkroom' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="outfits"
        options={{
          title: 'Outfits',
          headerRight: () => <AddButton href="/new-outfit" label="New outfit" />,
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'square.stack', android: 'style', web: 'style' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
