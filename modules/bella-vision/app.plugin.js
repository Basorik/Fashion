const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const DEPENDENCIES = 'com.google.mlkit.vision.DEPENDENCIES';

// Asks Google Play services to download the ML Kit subject segmentation model
// when the app is installed. The setting lives in the app's own manifest and
// replaces the one from expo-dev-launcher (whose barcode scanner model is kept
// in the list), because two libraries declaring it fails the manifest merge.
module.exports = function withBellaVision(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      DEPENDENCIES,
      'subject_segment,barcode_ui',
    );
    const item = application['meta-data'].find((entry) => entry.$['android:name'] === DEPENDENCIES);
    item.$['tools:replace'] = 'android:value';
    return config;
  });
};
