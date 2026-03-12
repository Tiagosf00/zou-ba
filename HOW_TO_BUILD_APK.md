# How to Build APK for Chinese Practice App

To export your app as an APK (Android Package), we will use **EAS Build** (Expo Application Services).

## Prerequisites
1.  **Expo Account**: You need an account at [expo.dev](https://expo.dev/signup).
2.  **EAS CLI**: The command line tool for building.

## Steps

### 1. Install EAS CLI
Run this command in your terminal:
```bash
npm install -g eas-cli
```

### 2. Login to Expo
Log in with your Expo account credentials:
```bash
eas login
```

### 3. Configure the Project
Initialize the build configuration (a file named `eas.json` will be created).
```bash
eas build:configure
```
*   Select **Android** when asked.

### 4. Adjust Configuration for APK (Optional but Recommended)
By default, EAS might set up an "App Bundle" (.aab) for the Play Store. If you just want an `.apk` file to install directly on your phone, open the newly created `eas.json` and check the `preview` profile. It usually looks like this:
```json
// eas.json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    // ...
  }
}
```
*If `preview` doesn't exist or doesn't have `"buildType": "apk"`, you can add it.*

### 5. Build the APK
Run the build command:
```bash
eas build -p android --profile preview
```

### 6. Download
*   Wait for the build to finish (it runs in the cloud).
*   Once done, EAS will provide a **Download Link** and a **QR Code**.
*   Scan the QR code with your Android phone to install correctly, or download the `.apk` file to your computer.

## Alternative: Local Build (Advanced)
If you have Android Studio and Java installed and configured on this machine, you can build locally:
```bash
eas build -p android --profile preview --local
```
*Note: This requires a full Android development environment setup.*
