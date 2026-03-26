import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.visiontracker.app',
  appName: 'Vision Tracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
