import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// --- Notification Handler (Foreground) ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      // alert('Failed to get push token for push notification!'); // Optional: Inform user
      return;
    }
    // Learn more about projectId: https://docs.expo.dev/guides/push-notifications/#projectid
    // EAS project ID is usually automatically inferred after `eas login` / `eas project:init`
    try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log('Expo Push Token:', token);
    } catch(e) {
        console.error("Could not get Expo Push Token:", e);
    }

  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}


export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // --- Listener for received notifications ---
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notification Received:', notification);
    });

    // --- Listener for user interaction with notifications ---
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Response:', response);
      // --- Handle notification tap here ---
      // Example: Navigate to a specific screen or URL within the WebView
      // const urlToOpen = response.notification.request.content.data?.url;
      // if (urlToOpen) {
      //    webViewRef.current?.injectJavaScript(`window.location.href = '${urlToOpen}';`);
      // }
    });

    // --- Cleanup listeners on unmount ---
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // You can return the token if you need to send it to your backend
  return { expoPushToken, notification };
}