import { useRef, useState } from 'react';
import { Alert } from 'react-native';

// Runs one async action at a time, so a double tap on "Save" can't save twice,
// and shows an alert instead of failing silently if the action throws.
export function useBusy() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, errorTitle = 'Something went wrong') {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(errorTitle, error instanceof Error ? error.message : String(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return [busy, run] as const;
}
