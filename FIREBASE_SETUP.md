# Firebase Setup Guide - Multi-Device Synchronization

This guide will help you set up Firebase Realtime Database for cross-device synchronization of the Word Master application.

## Prerequisites

1. A Google account
2. Access to Firebase Console

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "word-master-sync")
4. Follow the setup wizard:
   - Disable Google Analytics (optional, not needed for this)
   - Click **"Create project"**
5. Wait for project creation to complete

## Step 2: Enable Realtime Database

1. In your Firebase project, click **"Realtime Database"** in the left menu
2. Click **"Create Database"**
3. Choose a location (select closest to your users)
4. **Important:** Start in **"Test mode"** for now
   - We'll configure security rules later
5. Click **"Enable"**

## Step 3: Get Firebase Configuration

1. Click the gear icon ⚙️ next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** `</>`
5. Register your app:
   - Enter app nickname (e.g., "Word Master Web")
   - **DO NOT** check "Also set up Firebase Hosting"
   - Click **"Register app"**
6. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env` in your project root:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in the Firebase values:
   ```env
   VITE_FIREBASE_API_KEY=AIza... (from config)
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

3. **For Vercel deployment**, add these same variables:
   - Go to your Vercel project settings
   - Navigate to **Environment Variables**
   - Add each variable with the same names (VITE_FIREBASE_*)

## Step 5: Configure Security Rules (Important!)

1. In Firebase Console, go to **Realtime Database** > **Rules** tab
2. Replace the rules with:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "messages": {
          ".read": true,
          ".write": true,
          "$messageId": {
            ".validate": "newData.hasChildren(['data', 'timestamp'])"
          }
        }
      }
    }
  }
}
```

3. Click **"Publish"**

**Note:** These rules allow read/write to all rooms. For production, consider:
- Adding authentication
- Rate limiting
- Room-based access control

## Step 6: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open browser console and check for:
   - `"Firebase initialized successfully"` message
   - No Firebase errors

3. Test multi-device sync:
   - Open Action page on Device 1
   - Open Manage and View pages on Device 2
   - Select a row on Device 1
   - Verify it appears on Device 2

## Step 7: Deploy to Vercel

1. Make sure `.env` is in `.gitignore` (it should be by default)
2. Add environment variables in Vercel:
   - Project Settings > Environment Variables
   - Add all `VITE_FIREBASE_*` variables
3. Redeploy your application

## How It Works

### Architecture

```
Device 1 (Action Page)
  ↓
  BroadcastChannel (same-device tabs)
  ↓
  Firebase Realtime Database
  ↓
  BroadcastChannel (same-device tabs)
  ↓
Device 2 (Manage + View Pages)
```

### Features

1. **Hybrid Sync:**
   - BroadcastChannel: Fast same-device sync (tabs on one device)
   - Firebase: Cross-device sync (different devices/networks)

2. **Room System:**
   - Default room: `default-room`
   - All devices in the same room sync together
   - Change room via `VITE_ROOM_ID` environment variable

3. **Real-time Updates:**
   - All messages are synchronized instantly
   - Works with timer, video, selections, etc.

## Troubleshooting

### Firebase not initializing

**Check:**
1. Environment variables are set correctly
2. `.env` file exists in project root
3. For Vercel: Variables are added in project settings
4. Database URL format: `https://your-project-default-rtdb.firebaseio.com/`

### Messages not syncing

**Check:**
1. Browser console for Firebase errors
2. Firebase Console > Realtime Database > Data tab to see if messages are being written
3. Network tab for Firebase requests
4. Security rules allow read/write

### "Permission denied" errors

**Solution:**
- Update security rules (Step 5)
- Make sure rules are published

## Cost Considerations

**Free Tier (Spark Plan):**
- 1 GB storage
- 10 GB/month downloads
- 100 concurrent connections

For typical usage, this is more than enough.

**Upgrade if needed:**
- Blaze Plan (pay-as-you-go) if you exceed free tier
- Very affordable for small to medium usage

## Security Recommendations (Production)

1. **Add Authentication:**
   ```javascript
   // Only allow authenticated users
   {
     "rules": {
       "rooms": {
         ".read": "auth != null",
         ".write": "auth != null"
       }
     }
   }
   ```

2. **Rate Limiting:**
   - Consider implementing rate limiting in your app
   - Firebase doesn't have built-in rate limiting for Realtime Database

3. **Room-based Access:**
   - Implement room passwords or invite codes
   - Store room permissions in database

## Support

If you encounter issues:
1. Check Firebase Console for errors
2. Check browser console for JavaScript errors
3. Verify environment variables are correct
4. Test with Firebase Console's Realtime Database viewer

