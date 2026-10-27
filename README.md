# 🍺 PintTracker

A fast, private drink tracker. Log a drink in one tap, even mid-conversation at the bar. Then review your habits on a calendar, a year of coloured dots, and a stats page.

One codebase runs as a **web app / installable PWA** and as a **native Android app** (via Capacitor).

## Features

- **One-tap logging.** Big buttons for large beer (500 ml), small beer (330 ml), pint, wine, cocktail, single (35 ml) and double (70 ml) spirit, shot and fizz, plus water. Each button shows its volume. Tap to log; **hold** to adjust size, ABV, price or time. Every log shows an **Undo** toast.
- **Tonight view.** A progress ring against your daily limit (it turns red when you go over), drink count, spend, time since your last drink, and a pace warning (3+ drinks in an hour). There's also a weekly progress bar.
- **Drinking nights, not calendar days.** Drinks before 5am (configurable) count toward the night before.
- **Calendar.** A month grid with one dot per day, coloured by intake: green ring = dry, then pale gold → amber → orange → red for heavy days. Tap any day to see, edit or back-fill drinks.
- **Year in dots.** The last 12 months, one row per month.
- **Stats** for 4 weeks / 3 months / 12 months / all time:
  - average per week against your limit, % dry days, current and longest dry streak
  - total units, average per drinking day, over-limit days and weeks, heaviest day
  - money spent and estimated calories
  - charts: units per week (with a limit line), average by weekday, time of day, breakdown by type, your usual order
- **Units your way.** UK units (8 g), US standard drinks (14 g), or AU/EU standard drinks (10 g). Daily and weekly limits are editable.
- **Custom buttons.** Add, edit, reorder or remove quick-log presets, each with its own price.
- **Sync across devices.** Sign in with email and the same drinks show up on your phone and on the web. It works offline and syncs when you reconnect. Without signing in, everything stays on the device.
- **Backups.** Back up or restore as JSON, or export a CSV.
- Dark and light themes, the Android back button, haptics, and offline support.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the units/stats logic
npm run build      # production web build in dist/
```

## Firebase (sync)

- Project: `pinttracker-3997` (console: https://console.firebase.google.com/project/pinttracker-3997)
- **Firestore** stores `users/{uid}` (settings) and `users/{uid}/entries/{id}` (drinks). `firestore.rules` lets each user touch only their own data.
- **Auth:** email/password.
- **Hosting:** https://pint-tracker.web.app

```bash
npm run deploy:rules    # deploy Firestore security rules
npm run emulators       # local Auth + Firestore emulators (needs JDK 21)
npm run dev:emulators   # dev server pointed at the emulators
```

## Web app

Live at **https://pint-tracker.web.app**. It updates on every release. On a phone, open it and choose **Add to Home screen** to get a full-screen, offline-capable app.

## Android app

Install the latest APK from **[GitHub Releases](https://github.com/acc-studio/pinttracker/releases/latest)**. After that, the app **updates itself**: on launch and when resumed, it checks `android/latest.json` on Firebase Hosting. When a newer version exists, it shows an **Update** banner, downloads the APK, and opens Android's installer. The first time, Android asks you to allow installs from PintTracker. Settings → *Check for updates* forces a check.

In-app updates only work because every release is signed with the **same key**. It lives in `~/.pinttracker-signing/` (`release.jks` + `password.txt`) and in the repo secrets. **Back it up.** If it's lost, existing installs can never update again and have to be reinstalled.

For local development, `npm run android` opens Android Studio, and `npm run android:release` builds a signed APK on this machine.

## Releasing

```bash
npm run release:patch   # 1.3.0 -> 1.3.1  (also :minor / :major)
```

This bumps `package.json`, commits, tags `vX.Y.Z` and pushes. The tag triggers `.github/workflows/release.yml`, which:

1. runs the tests, builds the web app and a **signed** release APK (versionCode = major·10000 + minor·100 + patch);
2. publishes a GitHub Release with the APK attached;
3. deploys the web app to Firebase Hosting with `android/latest.json`, which points at that APK, so installed apps update themselves. The APK itself stays on GitHub because Firebase's free plan doesn't allow `.apk` files.

Repo secrets used: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT` (the `github-deploy` service account, which has only Hosting deploy rights).

`ci.yml` runs tests, lint and the build on every push and pull request.

Icons are generated from `public/icon.svg`: run `npm run icons`, then `npx @capacitor/assets generate --android`.

---

Units and calories are estimates. This is not medical advice.
