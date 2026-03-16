# Weekly Planner Setup Guide

This guide walks you through getting your planner app live on the internet so you can use it on your phone, laptop, and any other device with everything synced.

## What you need before starting

- A computer (Windows, Mac, or Linux)
- A Google account (for Firebase, the free database)
- A GitHub account (free, for deploying the app)

## Step 1: Install Node.js

Node.js is what lets you run and build the app on your computer.

1. Go to https://nodejs.org
2. Download the LTS version (the big green button)
3. Run the installer, click Next through everything
4. To verify it worked, open your terminal (Command Prompt on Windows, Terminal on Mac) and type:

```
node --version
```

You should see a version number like v20.x.x


## Step 2: Set up Firebase (your free database)

Firebase stores your tasks, habits, and notes in the cloud so they sync across devices.

1. Go to https://console.firebase.google.com
2. Click "Create a project" (or "Add project")
3. Name it `weekly-planner` and click Continue
4. Turn OFF Google Analytics (you don't need it) and click Create Project
5. Once it's ready, click Continue

### Add a web app
1. On the project overview page, click the web icon (looks like `</>`)
2. Name it `weekly-planner`
3. Do NOT check "Firebase Hosting" (we'll use Vercel instead)
4. Click "Register app"
5. You'll see a code block with `firebaseConfig`. Keep this page open, you'll need these values in Step 4

### Enable email login
1. In the left sidebar, click Build > Authentication
2. Click "Get started"
3. Click on "Email/Password"
4. Toggle the first switch to Enable
5. Click Save

### Create the database
1. In the left sidebar, click Build > Firestore Database
2. Click "Create database"
3. Select "Start in test mode" (we'll secure it later)
4. Pick the closest location to you (e.g., `us-east1` or `northamerica-northeast1` for Canada)
5. Click Enable

### Enable file storage (for images in notebooks)
1. In the left sidebar, click Build > Storage
2. Click "Get started"
3. Select "Start in test mode"
4. Pick the same region you chose for Firestore
5. Click Done


## Step 3: Download and set up the project

1. Unzip the `weekly-planner.zip` file you downloaded
2. Open your terminal and navigate to the folder:

```
cd path/to/weekly-planner
```

3. Install the dependencies:

```
npm install
```

This will take a minute.


## Step 4: Add your Firebase config

1. Open the file `src/firebase.js` in any text editor (Notepad, VS Code, etc.)
2. Replace the placeholder values with the ones from Step 2:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // your actual API key
  authDomain: "weekly-planner-xxxxx.firebaseapp.com",
  projectId: "weekly-planner-xxxxx",
  storageBucket: "weekly-planner-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

3. Save the file


## Step 5: Test it locally

Run this in your terminal:

```
npm run dev
```

Open your browser to `http://localhost:5173`. You should see the login screen. Create an account with any email and password, and your planner should load. Try adding tasks and refreshing the page. They should persist.

Press Ctrl+C in the terminal to stop the server when you're done testing.


## Step 6: Deploy to Vercel (free hosting)

Vercel gives you a free URL where your app lives on the internet.

1. Go to https://vercel.com and sign up with your GitHub account
2. Go to https://github.com and create a new repository called `weekly-planner`
3. In your terminal, inside the project folder, run:

```
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/weekly-planner.git
git branch -M main
git push -u origin main
```

4. Back on Vercel, click "Add New Project"
5. Import your `weekly-planner` repository from GitHub
6. Leave all settings as default and click "Deploy"
7. Wait about a minute. Vercel will give you a URL like `weekly-planner-abc123.vercel.app`

That's your app! It's now live on the internet.


## Step 7: Install on your devices

### On your phone (iPhone or Android)
1. Open the Vercel URL in your phone's browser (Safari on iPhone, Chrome on Android)
2. iPhone: tap the Share button > "Add to Home Screen"
3. Android: tap the three dots menu > "Add to Home Screen" or "Install app"
4. It now appears as an app icon on your home screen

### On your laptop
1. Open the URL in Chrome
2. Click the install icon in the address bar (looks like a monitor with a down arrow)
3. Or click the three dots menu > "Install Weekly Planner"
4. It opens in its own resizable window, separate from the browser
5. You can pin it to your taskbar

### Sign in on each device
Use the same email and password on every device. Your tasks, habits, and notes will sync automatically in real time.


## Step 8: Secure your database and storage (do this after everything works)

The "test mode" rules expire after 30 days. Replace them with proper rules:

### Firestore rules
1. Go to Firebase Console > Firestore Database > Rules
2. Replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

### Storage rules
1. Go to Firebase Console > Storage > Rules
2. Replace everything with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

3. Click "Publish"

This ensures only you can read and write your own data, and caps image uploads at 10MB each.


## Troubleshooting

**"Module not found" errors when running npm run dev**
Run `npm install` again.

**Login doesn't work**
Double check that you enabled Email/Password authentication in Firebase (Step 2).

**Tasks don't save**
Make sure your Firebase config values in `src/firebase.js` are correct, and that you created the Firestore database (Step 2).

**App won't install on phone**
Make sure you're visiting the HTTPS URL (Vercel URLs are always HTTPS). The install option only appears on HTTPS sites.

**Changes on one device don't show on another**
Make sure you're signed in with the same account on both devices. Changes sync in real time, so they should appear within a second.
