import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.pinttracker',
  appName: 'PintTracker',
  webDir: 'dist',
  backgroundColor: '#100d0a',
  android: {
    // Data lives in WebView storage on-device; nothing is sent anywhere.
    allowMixedContent: false,
  },
}

export default config
