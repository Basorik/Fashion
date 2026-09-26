import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { AddButton, HeaderTextButton } from '@/components/add-button';

function tabIcon(name: SymbolViewProps['name']) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShadowVisible: false, headerTitleAlign: 'left' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wardrobe',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <HeaderTextButton href="/log-wear" label="Log wear" />
              <AddButton href="/add-item" label="Add item" />
            </View>
          ),
          tabBarIcon: tabIcon({ ios: 'tshirt', android: 'checkroom', web: 'checkroom' }),
        }}
      />
      <Tabs.Screen
        name="outfits"
        options={{
          title: 'Outfits',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <HeaderTextButton href="/shuffle" label="Shuffle" />
              <AddButton href="/new-outfit" label="New outfit" />
            </View>
          ),
          tabBarIcon: tabIcon({ ios: 'square.stack', android: 'style', web: 'style' }),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: tabIcon({
            ios: 'calendar',
            android: 'calendar_month',
            web: 'calendar_month',
          }),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: tabIcon({ ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' }),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: tabIcon({ ios: 'list.bullet', android: 'checklist', web: 'checklist' }),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
