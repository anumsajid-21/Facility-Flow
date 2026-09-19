import type { CapacitorConfig } from '@capacitor/cli';

// This app loads the live Next.js dev server on the PC's LAN IP directly,
// rather than bundling a static build - so it only works while that PC is
// running the dev servers and the phone is on the same WiFi network.
const config: CapacitorConfig = {
  appId: 'com.facilityflow.app',
  appName: 'FacilityFlow',
  webDir: 'public',
  server: {
    url: 'http://192.168.0.101:3000',
    cleartext: true,
  },
};

export default config;
