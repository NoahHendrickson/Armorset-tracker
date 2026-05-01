# Phase 0 Spike — Bungie API derivation

Goal: prove that for any armor 3.0 piece in a real account we can derive
`(set, archetype, tuning)` from the Bungie API + manifest. Without this,
the rest of the app is speculative.

## One-time setup

### 1. Register a Bungie dev app

1. Go to <https://www.bungie.net/en/Application> and sign in.
2. Click **Create New App**.
3. Fill in:
   - **Application Name**: `armor-checklist-dev` (anything works)
   - **Website**: any URL you control (or `https://localhost:7777`)
   - **OAuth Client Type**: `Confidential` (gives you a `client_secret`)
   - **Redirect URL**: `https://localhost:7777/callback`
     - Bungie requires HTTPS. The page won't actually load — we just need
       the URL bar to contain the `?code=...` after the redirect.
   - **Scope**: check `Read your Destiny 2 information (Vault, Inventory, and Vendors)`
4. Save. You now have an **API Key**, **OAuth client_id**, and **OAuth client_secret**.

### 2. Configure local env

```bash
cd spike
cp .env.example .env.local
# Open .env.local and paste in your three values
```

### 3. Install deps

```bash
cd spike
npm install
```

## Get an access token (one-shot OAuth)

```bash
cd spike
npm run oauth
```

This prints an authorize URL. Open it in a browser, sign in, and approve.
Bungie redirects to your registered URL (the page won't load — that's
expected). Copy the **full URL from the browser address bar** and paste it
back into the CLI when prompted.

Tokens land in `spike/.tokens.json` (gitignored). Access tokens last ~1
hour; the refresh token lasts ~90 days. Run `npm run refresh` to mint a
fresh access token without redoing the browser dance.

## Run the derivation

```bash
cd spike
npm run derive
```

This will:

1. Resolve your `(membershipType, membershipId)` via `GetMembershipsForCurrentUser`.
2. Sync the Destiny manifest (downloads on first run, cached in `manifest-cache/`).
3. Pull your full profile via `Destiny2.GetProfile`.
4. Walk every armor 3.0 piece across characters + vault and print:

   ```
   slot       set                archetype     tuning      itemInstanceId
   helmet     Ferropotent        Gunner        Weapon      6917529...
   arms       Ferropotent        Gunner        Weapon      6917529...
   ...
   ```

5. Write findings to `../docs/spike-findings.md` — confirmed
   `socketCategoryHash` constants, set-derivation method, anomalies.

## Exit criteria

- Script outputs correct `(set, archetype, tuning)` for every armor 3.0
  piece in a real account.
- `docs/spike-findings.md` has the verified hash constants the production
  app will reuse in Phase 2.
