// Resolves the manifest-merger conflict between @six33/react-native-bg-removal
// (com.google.mlkit.vision.DEPENDENCIES=subject_segment) and expo-dev-launcher
// (=barcode_ui): both ML Kit auto-download modules must be listed together.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withMlkitManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = manifest.application[0];
    application['meta-data'] = (application['meta-data'] ?? []).filter(
      (entry) => entry.$['android:name'] !== 'com.google.mlkit.vision.DEPENDENCIES',
    );
    application['meta-data'].push({
      $: {
        'android:name': 'com.google.mlkit.vision.DEPENDENCIES',
        'android:value': 'subject_segment,barcode_ui',
        'tools:replace': 'android:value',
      },
    });
    return config;
  });
};
