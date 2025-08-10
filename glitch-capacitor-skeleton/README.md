# Glitch Video — Android APK via GitHub Actions (Capacitor)

Minimal Vite+React+Tailwind project + two workflows:
- **Build Android APK (Capacitor)** — debug APK artifact
- **Build Android Release (Capacitor, signed)** — signed APK and/or AAB (needs secrets)

## Quick start
```bash
npm i
npm run build
# push to GitHub and run Actions (or run locally with Capacitor)
```

### Run workflows (recommended)
- Push this repo to GitHub.
- Actions → run the workflows. For signed release, add secrets:
  - ANDROID_KEYSTORE_BASE64
  - ANDROID_KEYSTORE_PASSWORD
  - ANDROID_KEY_ALIAS
  - ANDROID_KEY_PASSWORD
