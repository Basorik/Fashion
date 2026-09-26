import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onScanned: (code: string) => void;
  onClose: () => void;
};

// Full-screen camera that reports the first retail barcode (UPC/EAN) it sees.
export function BarcodeScanner({ visible, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera fires many events per second; only the first one counts.
  const handled = useRef(false);

  function handleScan(result: BarcodeScanningResult) {
    if (handled.current) return;
    handled.current = true;
    onScanned(result.data);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={() => {
        handled.current = false;
      }}
      onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleScan}
          />
        ) : (
          <View style={styles.permission}>
            <ThemedText style={styles.light}>Bella needs the camera to scan barcodes.</ThemedText>
            <View style={styles.row}>
              <Button label="Allow camera" onPress={requestPermission} primary />
            </View>
          </View>
        )}
        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <ThemedText style={[styles.light, styles.hint]}>
            Point at the barcode on the tag
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <ThemedText type="smallBold" style={styles.light}>
              Cancel
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permission: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
  },
  hint: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  close: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  light: {
    color: '#fff',
  },
});
