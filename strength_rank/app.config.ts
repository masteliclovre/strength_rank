import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';

const ANDROID_GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

if (!ANDROID_GOOGLE_MAPS_KEY) {
  console.warn('GOOGLE_MAPS_API_KEY is not set. Android maps may not work as expected.');
}

const config: ExpoConfig = {
  name: 'strength_rank',
  slug: 'strength_rank',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'strengthrank',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: 'com.anonymous.strength_rank',
    config: {
      googleMaps: {
        apiKey: ANDROID_GOOGLE_MAPS_KEY,
      },
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Strength Rank to access your media so you can attach lift videos.',
        cameraPermission:
          'Allow Strength Rank to use your camera to record PR videos.',
      },
    ],
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default ({ config: existingConfig }: ConfigContext): ExpoConfig => ({
  ...existingConfig,
  ...config,
});
