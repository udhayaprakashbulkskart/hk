import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushResult =
  | { status: "granted"; token: string }
  | { status: "denied" }
  | { status: "not-configured"; message: string }
  | { status: "unsupported"; message: string };

/**
 * Asks for notification permission and fetches an Expo push token.
 * The token is not sent anywhere yet: the backend that stores it arrives in Phase 4.
 */
export async function enablePushNotifications(): Promise<PushResult> {
  if (Platform.OS === "web") return { status: "unsupported", message: "Push notifications are available in the mobile app." };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    return { status: "not-configured", message: "Push needs an EAS project ID. It is added when the app is linked to EAS." };
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
  }
  if (!granted) return { status: "denied" };
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: "granted", token: data };
}
