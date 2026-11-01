# Firebase Cloud Messaging (FCM) Setup Guide

## ✅ What's Been Configured

1. **Packages Installed:**
   - `@react-native-firebase/app` - Firebase core
   - `@react-native-firebase/messaging` - Push notifications

2. **Configuration Files Updated:**
   - `app.json` - Added Firebase plugins
   - `app.config.js` - Added Firebase plugins
   - Android `google-services.json` - Already present ✓

3. **New Service Created:**
   - `services/firebaseNotifications.ts` - Complete Firebase messaging service

4. **App Initialization:**
   - `app/_layout.tsx` - Firebase messaging auto-initializes on app start

## 📱 Android Setup (Already Complete!)

Your Android configuration is ready with `google-services.json` already in place.

## 🍎 iOS Setup (Required)

You need to add `GoogleService-Info.plist` for iOS:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **hotelclash-6f02d**
3. Go to Project Settings → Your iOS app
4. Download `GoogleService-Info.plist`
5. Place it at: `ios/GoogleService-Info.plist`

## 🔨 Build Commands

After adding iOS config file, rebuild the app:

```bash
# Prebuild with new native modules
npx expo prebuild --clean

# Build for Android
eas build --platform android --profile production

# Build for iOS (after adding GoogleService-Info.plist)
eas build --platform ios --profile production
```

## 🧪 Testing Notifications

### 1. Get Your FCM Token

When you run the app, check the logs for:
```
[Firebase] FCM Token: <your-device-token>
```

### 2. Send a Test Notification

Use Firebase Console:
1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Enter title and body
4. Click "Send test message"
5. Paste your FCM token
6. Click "Test"

Or use this curl command:
```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "YOUR_DEVICE_FCM_TOKEN",
    "notification": {
      "title": "Test Notification",
      "body": "Hello from Firebase!"
    },
    "data": {
      "screen": "game",
      "custom_key": "custom_value"
    }
  }'
```

### 3. Test Different States

The app handles notifications in:
- **Foreground** - Shows notification banner using expo-notifications
- **Background** - Handled by Firebase background handler
- **Quit/Killed** - User taps notification to open app

## 📊 Available Functions

From `services/firebaseNotifications.ts`:

```typescript
// Initialize (called automatically in _layout.tsx)
await initializeFirebaseMessaging();

// Get FCM token
const token = await getFCMToken();

// Subscribe to topics (e.g., "all_users", "premium_users")
await subscribeToTopic('game_updates');

// Unsubscribe from topics
await unsubscribeFromTopic('game_updates');

// Delete token (useful on logout)
await deleteFCMToken();
```

## 🎯 Example: Subscribe Users to Topics

Add this to your login/register flow:

```typescript
import { subscribeToTopic } from '../services/firebaseNotifications';

// After successful login
await subscribeToTopic('all_users');
await subscribeToTopic('game_updates');
```

## 🔔 Notification Payload Structure

When sending notifications from your backend:

```json
{
  "to": "USER_FCM_TOKEN",
  "notification": {
    "title": "Level Up!",
    "body": "You've reached level 10!"
  },
  "data": {
    "screen": "profile",
    "userId": "123",
    "action": "open_profile"
  }
}
```

## 🚀 Next Steps

1. **Add iOS GoogleService-Info.plist** (if building for iOS)
2. **Rebuild the app**: `npx expo prebuild --clean`
3. **Test with Firebase Console** to send test notifications
4. **Send FCM tokens to your backend** to enable server-side notifications
5. **Handle navigation** based on notification data in the message handlers

## 📝 Notes

- Notification permissions are requested automatically on app start
- FCM tokens are logged to console for testing
- Foreground notifications use expo-notifications for display
- Background/quit notifications are handled natively by Firebase
- Topic subscriptions allow targeting groups of users

## 🐛 Troubleshooting

**Android not receiving notifications?**
- Check `google-services.json` is in `android/app/`
- Verify package name matches: `com.olympikesoft.hotelheroapp`
- Run `npx expo prebuild --clean`

**iOS not receiving notifications?**
- Add `GoogleService-Info.plist` to `ios/` folder
- Check bundle ID matches: `com.olympikesoft.hotelheroapp`
- Enable Push Notifications capability in Xcode

**Token not generating?**
- Check logs for permission status
- Ensure device has internet connection
- Try uninstalling and reinstalling the app
