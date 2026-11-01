import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('[Firebase] Notification permission granted:', authStatus);
    } else {
      console.log('[Firebase] Notification permission denied');
    }

    return enabled;
  } catch (error) {
    console.error('[Firebase] Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Get the FCM token for this device
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    console.log('[Firebase] FCM Token:', token);
    return token;
  } catch (error) {
    console.error('[Firebase] Error getting FCM token:', error);
    return null;
  }
}

/**
 * Initialize Firebase Cloud Messaging
 */
export async function initializeFirebaseMessaging(): Promise<void> {
  try {
    // Request permission
    const hasPermission = await requestNotificationPermission();
    
    if (!hasPermission) {
      console.log('[Firebase] No notification permission, skipping FCM setup');
      return;
    }

    // Get FCM token
    const token = await getFCMToken();
    
    if (token) {
      // TODO: Send this token to your backend server to send push notifications
      console.log('[Firebase] Device registered for push notifications');
    }

    // Listen for token refresh
    messaging().onTokenRefresh((newToken) => {
      console.log('[Firebase] FCM Token refreshed:', newToken);
      // TODO: Send the new token to your backend
    });

    // Handle foreground messages
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      console.log('[Firebase] Foreground notification received:', remoteMessage);
      
      // Display notification using expo-notifications
      if (remoteMessage.notification) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification.title || 'Notification',
            body: remoteMessage.notification.body || '',
            data: remoteMessage.data || {},
          },
          trigger: null, // Show immediately
        });
      }
    });

    // Handle background/quit state messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[Firebase] Background notification received:', remoteMessage);
      // Process the message in the background
    });

    // Handle notification opened app (when app was in background/quit)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[Firebase] Notification opened app from background:', remoteMessage);
      // Navigate to specific screen based on notification data
      // You can use navigation here if needed
    });

    // Check if app was opened by a notification (when app was quit)
    const initialNotification = await messaging().getInitialNotification();
    if (initialNotification) {
      console.log('[Firebase] App opened by notification:', initialNotification);
      // Handle the initial notification
    }

    console.log('[Firebase] Messaging initialized successfully');
  } catch (error) {
    console.error('[Firebase] Error initializing messaging:', error);
  }
}

/**
 * Subscribe to a topic
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  try {
    await messaging().subscribeToTopic(topic);
    console.log(`[Firebase] Subscribed to topic: ${topic}`);
  } catch (error) {
    console.error(`[Firebase] Error subscribing to topic ${topic}:`, error);
  }
}

/**
 * Unsubscribe from a topic
 */
export async function unsubscribeFromTopic(topic: string): Promise<void> {
  try {
    await messaging().unsubscribeFromTopic(topic);
    console.log(`[Firebase] Unsubscribed from topic: ${topic}`);
  } catch (error) {
    console.error(`[Firebase] Error unsubscribing from topic ${topic}:`, error);
  }
}

/**
 * Delete FCM token (useful for logout)
 */
export async function deleteFCMToken(): Promise<void> {
  try {
    await messaging().deleteToken();
    console.log('[Firebase] FCM token deleted');
  } catch (error) {
    console.error('[Firebase] Error deleting FCM token:', error);
  }
}
