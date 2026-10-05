import type { ExpoConfig } from "expo/config";
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "feb20780-3420-405b-bc6e-69f7b6e608d9";
const config: ExpoConfig = {
  name: "ReliantOutreach",
  slug: "reliantoutreach-team",
  owner: "reliantoutreach-team",
  version: "1.0.0",
  scheme: "reliantoutreach",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "com.reliantoutreach.mobile",
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "com.reliantoutreach.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#0129ac",
    },
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: true,
  },
  web: { bundler: "metro", output: "single", favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0a0b0f",
        image: "./assets/icon.png",
        imageWidth: 100,
      },
    ],
    ["expo-notifications", { color: "#3358ff", defaultChannel: "replies" }],
  ],
  extra: { ...(projectId ? { eas: { projectId } } : {}) },
};
export default config;
