# How to Test Your App Locally

You can test your app in two ways: within your computer's web browser or directly on your phone.

## Option 1: Web Browser (Fastest)
This runs the app like a website. Perfect for testing layout and logic quickly.

1.  Open your terminal in the project folder.
2.  Run this command:
    ```bash
    npx expo start --web
    ```
3.  The text "Webpack compiling..." will appear.
4.  Your browser should automatically open to `http://localhost:8081`.

## Option 2: Mobile Phone (Expo Go)
This runs the app natively on your phone. Best for testing touch gestures and real feel.

1.  **Install App**: Download "Expo Go" from the App Store (iOS) or Play Store (Android).
2.  **Start Server**: Run this command:
    ```bash
    npx expo start
    ```
3.  **Scan QR**:
    *   **Android**: Open Expo Go and scan the QR code shown in the terminal.
    *   **iOS**: Open your Camera app and scan the QR code.
4.  The app will load over Wi-Fi (make sure your phone and computer are on the same network).

## Troubleshooting
*   If you see "Network Error", ensure both devices are on the same Wi-Fi.
*   To stop the server, press `Ctrl + C` in the terminal.
