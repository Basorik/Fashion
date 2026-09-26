import { Alert, type AlertButton } from 'react-native';

// React Native Web's Alert.alert does nothing, so confirmations and error
// messages would silently disappear. Bella's alerts are either a message with
// at most one button, or Cancel plus one action, which map onto the browser's
// own alert and confirm dialogs.
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((button) => button.style !== 'cancel');
  const cancel = buttons?.find((button) => button.style === 'cancel');
  if (!cancel || actions.length === 0) {
    window.alert(text);
    (actions[0] ?? cancel)?.onPress?.();
    return;
  }
  if (window.confirm(text)) {
    actions[0].onPress?.();
  } else {
    cancel.onPress?.();
  }
};
