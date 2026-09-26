const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// What Bella accepts from other apps' share menus: text (a selected email, or
// a product link), an email's HTML, and email files (.eml).
const SHARED_TYPES = ['text/plain', 'text/html', 'message/rfc822'];

// Adds Bella to Android's share menu by giving the main activity a SEND intent filter.
module.exports = function withBellaShare(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    const filters = (activity['intent-filter'] ??= []);
    const alreadyAdded = filters.some((filter) =>
      filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.SEND'),
    );
    if (!alreadyAdded) {
      filters.push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: SHARED_TYPES.map((type) => ({ $: { 'android:mimeType': type } })),
      });
    }
    return config;
  });
};
