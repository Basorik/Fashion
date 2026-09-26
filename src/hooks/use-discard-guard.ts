import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

// Asks before a form with unsaved changes is closed by the back button, the
// back gesture or a swipe down. Returns `leave`, which navigates away without
// asking, for use once the changes are saved.
export function useDiscardGuard(dirty: boolean) {
  const navigation = useNavigation();
  const [leaveWith, setLeaveWith] = useState<(() => void) | null>(null);

  usePreventRemove(dirty && leaveWith === null, ({ data }) => {
    Alert.alert('Discard changes?', "What you've changed here hasn't been saved.", [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  // Navigates on the render after the guard is lifted, so it doesn't ask.
  useEffect(() => {
    leaveWith?.();
  }, [leaveWith]);

  return (navigate: () => void) => setLeaveWith(() => navigate);
}
