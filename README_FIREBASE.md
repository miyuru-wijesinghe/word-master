# Firebase Multi-Device Setup - Quick Start

## 🚀 Quick Setup (5 minutes)

### 1. Create Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Click "Add project"
- Name: `word-master-sync` (or any name)
- Continue → Disable Analytics → Create project

### 2. Enable Realtime Database
- Click "Realtime Database" in left menu
- Click "Create Database"
- Choose location → Start in **Test mode** → Enable

### 3. Get Configuration
- Click ⚙️ Settings → Project settings
- Scroll to "Your apps" → Click Web icon `</>`
- Register app (nickname: "Word Master")
- **Copy the config object**

### 4. Add Environment Variables

**For Local Development:**
```bash
# Create .env file in project root
cp .env.example .env
```

Then edit `.env` and paste your Firebase config:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**For Vercel Deployment:**
1. Go to Vercel project → Settings → Environment Variables
2. Add all `VITE_FIREBASE_*` variables (same values)

### 5. Set Security Rules
- Firebase Console → Realtime Database → Rules tab
- Paste:
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "messages": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
```
- Click "Publish"

### 6. Test It!
```bash
npm run dev
```

Open console - you should see: `"Firebase initialized successfully"`

## 📱 Multi-Device Usage

**Device 1:** Open `https://word-master-three.vercel.app/action`
**Device 2:** Open `https://word-master-three.vercel.app/manage` and `/view`

Both devices will sync in real-time! 🎉

## 🔧 How It Works

- **BroadcastChannel**: Fast sync for tabs on same device
- **Firebase**: Cross-device sync via internet
- **Hybrid**: Uses both for best performance

## ❓ Troubleshooting

**"Firebase config not found"**
→ Check `.env` file exists and has all variables

**"Permission denied"**
→ Update security rules (Step 5)

**Messages not syncing**
→ Check Firebase Console → Realtime Database → Data tab
→ You should see `rooms/default-room/messages/` structure

## 💰 Cost
Free tier is plenty for testing and small use cases!

