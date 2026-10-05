import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
const memory = new Map<string, string>();
// Browser preview intentionally keeps credentials in memory only.
export const storage = {
  get: (key: string): Promise<string | null> =>
    Platform.OS === "web"
      ? Promise.resolve(memory.get(key) ?? null)
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> =>
    Platform.OS === "web"
      ? Promise.resolve(void memory.set(key, value))
      : SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
  remove: (key: string): Promise<void> =>
    Platform.OS === "web"
      ? Promise.resolve(void memory.delete(key))
      : SecureStore.deleteItemAsync(key),
};
