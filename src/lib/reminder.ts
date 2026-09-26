import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Href } from 'expo-router';

const REMINDER_ID = 'daily-wear-reminder';
const CHANNEL_ID = 'reminders';

export const ReminderHours = [18, 20, 21, 22] as const;

// "8 pm", in the phone's own clock style.
export function formatHour(hour: number) {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const remindersSupported = Platform.OS !== 'web';

// The hour the daily "what did you wear?" reminder is set for, or null when it's off.
// The scheduled notification itself is the setting, so there's nothing else to keep in sync.
export async function getReminderHour(): Promise<number | null> {
  if (!remindersSupported) return null;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminder = scheduled.find((request) => request.identifier === REMINDER_ID);
  const hour = reminder?.content.data?.hour;
  return typeof hour === 'number' ? hour : null;
}

// Turns the daily reminder on at `hour`, or off with null. Returns false when
// notifications aren't allowed.
export async function setReminderHour(hour: number | null): Promise<boolean> {
  if (!remindersSupported) return false;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  if (hour === null) return true;

  // Android needs a channel before it will ask for permission.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  const url: Href = '/log-wear';
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'What did you wear today?',
      body: 'Tap to log it in Bella.',
      data: { url, hour },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}
