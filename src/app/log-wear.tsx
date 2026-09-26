import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FooterBar } from '@/components/footer-bar';
import { ItemSelectGrid } from '@/components/item-select-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { addDays } from '@/lib/dates';
import { listWornOn, setWornOn, today } from '@/lib/db';
import { successFeedback } from '@/lib/haptics';
import {
  formatHour,
  getReminderHour,
  ReminderHours,
  remindersSupported,
  setReminderHour,
} from '@/lib/reminder';

// Tick off everything worn today (or yesterday) in one go. The evening
// reminder opens this screen.
export default function LogWearScreen() {
  const db = useSQLiteContext();
  const [day, setDay] = useState(today);
  const [selected, setSelected] = useState<number[]>([]);
  // The day `selected` was loaded for; saving waits until it matches `day`.
  const [loadedDay, setLoadedDay] = useState<string | null>(null);
  // What was already logged for that day, to ask before leaving with changes.
  const [loggedIds, setLoggedIds] = useState<number[]>([]);
  const [reminder, setReminder] = useState<number | null | undefined>(undefined);
  const [saving, run] = useBusy();

  useEffect(() => {
    let current = true;
    listWornOn(db, day).then((ids) => {
      if (!current) return;
      setSelected(ids);
      setLoggedIds(ids);
      setLoadedDay(day);
    });
    return () => {
      current = false;
    };
  }, [db, day]);

  useEffect(() => {
    getReminderHour().then(setReminder);
  }, []);

  const changed =
    loadedDay === day && [...selected].sort().join(',') !== [...loggedIds].sort().join(',');
  const leave = useDiscardGuard(changed);

  function save() {
    run(async () => {
      await setWornOn(db, day, selected);
      successFeedback();
      leave(() => router.back());
    }, 'Could not save');
  }

  async function chooseReminder(hour: number | null) {
    const previous = reminder;
    setReminder(hour);
    const ok = await setReminderHour(hour).catch(() => false);
    if (!ok) {
      setReminder(previous === undefined ? null : previous);
      Alert.alert(
        'Notifications are off',
        'Allow notifications for Bella in your phone settings to get a daily reminder.',
      );
    }
  }

  const yesterday = addDays(today(), -1);

  return (
    <ThemedView style={styles.container}>
      <ItemSelectGrid
        selected={selected}
        onChange={setSelected}
        header={
          <View style={styles.header}>
            <View style={styles.chips}>
              <Chip label="Today" selected={day === today()} onPress={() => setDay(today())} />
              <Chip
                label="Yesterday"
                selected={day === yesterday}
                onPress={() => setDay(yesterday)}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Tap everything you wore. Items you already logged are ticked.
            </ThemedText>
            {remindersSupported && reminder !== undefined && (
              <View style={styles.reminder}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Remind me every evening
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chips}>
                    <Chip
                      label="Off"
                      selected={reminder === null}
                      onPress={() => chooseReminder(null)}
                    />
                    {ReminderHours.map((hour) => (
                      <Chip
                        key={hour}
                        label={formatHour(hour)}
                        selected={reminder === hour}
                        onPress={() => chooseReminder(hour)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        }
      />
      <FooterBar>
        <Button
          label={
            selected.length === 0
              ? 'Nothing worn'
              : `Save ${selected.length} item${selected.length === 1 ? '' : 's'}`
          }
          onPress={save}
          busy={saving}
          disabled={loadedDay !== day}
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
  header: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  reminder: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
});
