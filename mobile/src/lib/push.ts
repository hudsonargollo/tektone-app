// Expo push registration — Android-first. iOS needs APNs credentials tied to
// a paid Apple Developer account (already deferred for device testing this
// session), so this degrades to a silent no-op there rather than throwing;
// same best-effort convention used everywhere else in this codebase.
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushAsync() {
  try {
    if (!Device.isDevice) return; // push tokens don't exist on simulators/emulators
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return; // `eas init` hasn't been run yet — nothing to register against

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerExpoPush(token);
  } catch {
    /* best-effort — a missed registration just means no push until next app open */
  }
}
