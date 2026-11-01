# tab-tracker

## Security notes

- **Deploy rules and hosting together** (`firebase deploy --only firestore:rules,hosting`). The CI workflow only deploys hosting, so rule changes in [firestore.rules](firestore.rules) must be deployed separately.
- **Headers**: [firebase.json](firebase.json) sets a strict CSP (no inline script, no `eval`), HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP. UI code lives in `public/app.js`; markup uses `data-*` attributes and delegated handlers instead of inline `onclick`. If you add a third-party origin, add it to the CSP.
- **Firebase SDK scripts** are pinned with SRI hashes in `public/index.html`. When upgrading the SDK version, regenerate the `integrity` values (`sha384`).
- **Auth**: Google sign-in only; there are no passwords or cookie sessions (tokens are managed by the Firebase Auth SDK). Rules require a Google-verified email.
- **Public by design**: the Firebase web config and the Cloudinary cloud name / unsigned preset ship to the browser. Protect them in the consoles instead:
  - Google Cloud Console → Credentials: restrict the browser API key to your hosting domains (HTTP referrers) and the Identity Toolkit / Firestore APIs; consider enabling Firebase App Check.
  - Cloudinary: lock the `listahan` upload preset to images only, a folder, a max file size, and (ideally) signed uploads.
- **Never commit** service-account keys or `.env` files (see `.gitignore`); CI credentials live in GitHub secrets.