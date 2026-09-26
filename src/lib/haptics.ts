import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Small vibrations that confirm an action. They never throw, and do nothing on
// web or on phones without a vibration motor.
const enabled = Platform.OS !== 'web';

function fire(feedback: () => Promise<void>) {
  if (enabled) feedback().catch(() => {});
}

// A selection changed: a chip, filter or toggle.
export function tapFeedback() {
  fire(() => Haptics.selectionAsync());
}

// Something was saved or logged.
export function successFeedback() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

// Asking before something that can't be undone, like a delete.
export function warningFeedback() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
