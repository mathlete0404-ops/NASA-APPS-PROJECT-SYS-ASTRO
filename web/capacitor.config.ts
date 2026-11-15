import type { CapacitorConfig } from '@capacitor/cli'

// Native iOS shell (WKWebView) around the Vite build in dist/. Everything — app code,
// MediaPipe wasm + .task models, Draco decoder, anatomy GLBs — ships inside the app bundle,
// so the app runs with no network. Camera frames never leave the device.
const config: CapacitorConfig = {
  appId: 'org.sysastro.crewmirror',
  appName: 'Crew Mirror',
  webDir: 'dist',
  // Same colour as the boot splash / theme-color, so there is no white flash on launch.
  backgroundColor: '#050816',
  ios: {
    // The web app has no env(safe-area-inset-*) handling, so let iOS keep content clear
    // of the notch, Dynamic Island and home indicator.
    contentInset: 'automatic',
    backgroundColor: '#050816',
  },
}

export default config
