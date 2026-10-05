import { Linking, Platform } from "react-native";
import * as Application from "expo-application";
import { API_URL, api } from "./api";
import { newerRelease } from "./attention-policy";
export const installedVersion = Application.nativeApplicationVersion;
export const installedBuild = Application.nativeBuildVersion;
export async function checkAppRelease() {
  if (Platform.OS !== "android") return null;
  const data = await api<{ android: unknown }>("/api/mobile-release");
  return newerRelease(data.android, installedBuild);
}
// Never follow an arbitrary download URL supplied in a response.
export const openAppDownload = () => Linking.openURL(`${API_URL}/download`);
