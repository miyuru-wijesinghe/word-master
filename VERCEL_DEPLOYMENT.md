# Vercel Deployment with Firebase - Quick Guide

## ✅ Firebase Configuration Added

Your Firebase credentials have been added to the code with fallback values. 

## 🚀 For Local Development

The `.env` file should be created automatically. If not, copy `.env.example` to `.env`:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Or manually create .env with these values (already in firebaseConfig.ts as fallback)
```

## ☁️ For Vercel Deployment

### Step 1: Add Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: `word-master-three` (or your project name)
3. Go to **Settings** → **Environment Variables**
4. Add these variables (one by one):

```
VITE_FIREBASE_API_KEY = AIzaSyBZewVYHndKa7p2-PL8bmWMNDurBqmixac
VITE_FIREBASE_AUTH_DOMAIN = word-master-sync.firebaseapp.com
VITE_FIREBASE_DATABASE_URL = https://word-master-sync-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID = word-master-sync
VITE_FIREBASE_STORAGE_BUCKET = word-master-sync.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 943536020597
VITE_FIREBASE_APP_ID = 1:943536020597:web:07c263d328789617bdac3c
```

5. **Important:** Select **"Production", "Preview", and "Development"** for each variable
6. Click **Save** for each one

### Step 2: Set Firebase Security Rules

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select project: **word-master-sync**
3. Go to **Realtime Database** → **Rules** tab
4. Copy the rules from `FIREBASE_SECURITY_RULES.json`:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "messages": {
          ".read": true,
          ".write": true,
          "$messageId": {
            ".validate": "newData.hasChildren(['data', 'timestamp'])",
            "data": {
              ".validate": "newData.hasChildren(['type'])"
            },
            "timestamp": {
              ".validate": "newData.isNumber() || newData.val() == null"
            }
          }
        }
      }
    }
  }
}
```

5. Click **Publish**

### Step 3: Redeploy on Vercel

1. After adding environment variables, go to **Deployments** tab
2. Click the **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger auto-deploy

## ✅ Verify It Works

After deployment:

1. Open `https://word-master-three.vercel.app` on your computer
2. Check the status indicator:
   - Should show: **🟢 Multi-Device Sync Enabled (Room: default-room)**
3. Open on a second device (phone/tablet):
   - Device 1: `/action`
   - Device 2: `/manage` and `/view`
4. Test synchronization:
   - Select rows on Device 1
   - Should appear on Device 2 instantly

## 🔍 Troubleshooting

**Status shows "Single-Device Mode":**
- Check environment variables are added in Vercel
- Make sure variables start with `VITE_`
- Redeploy after adding variables

**"Permission denied" errors:**
- Check Firebase security rules are published
- Verify rules match `FIREBASE_SECURITY_RULES.json`

**Messages not syncing:**
- Check browser console for errors
- Verify Firebase Console → Realtime Database shows data
- Check network tab for Firebase requests

## 📝 Notes

- **Fallback values are hardcoded** in `firebaseConfig.ts` for development
- **For production**, use environment variables (more secure)
- **Environment variables take precedence** over hardcoded values

---

✅ **You're all set!** Multi-device sync is ready to use.

