import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

// The web version has no share sheet for local files, so share buttons are hidden there.
export const canShare = Platform.OS !== 'web';

// Opens the phone's share sheet for a local file. Closing the sheet without
// picking an app is not an error.
export async function shareFile(uri: string, options?: Sharing.SharingOptions) {
  if (!canShare || !(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, options);
}
