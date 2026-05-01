import { randomBytes } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import {
  BUNGIE_AUTH_URL,
  BUNGIE_TOKEN_URL,
  loadConfig,
  saveTokens,
  TOKENS_PATH,
} from "./lib/config.js";

async function main() {
  const config = loadConfig();
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL(BUNGIE_AUTH_URL);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  console.log("\n=== Bungie OAuth — manual paste flow ===\n");
  console.log("1. Open this URL in your browser (signed in to Bungie.net):\n");
  console.log(`   ${authUrl.toString()}\n`);
  console.log("2. Approve the app. You'll be redirected to your app's registered redirect URL.");
  console.log("   The browser may show 'unable to connect' — that's fine if you registered a");
  console.log("   localhost / placeholder URL. The important part is the URL bar.\n");
  console.log("3. Copy the FULL URL from the browser address bar — it should contain ?code=... and &state=...\n");

  const rl = readline.createInterface({ input, output });
  const pasted = await rl.question("Paste the redirect URL here: ");
  rl.close();

  let code: string | null = null;
  let returnedState: string | null = null;

  const trimmed = pasted.trim();
  try {
    const parsed = new URL(trimmed);
    code = parsed.searchParams.get("code");
    returnedState = parsed.searchParams.get("state");
  } catch {
    if (trimmed.includes("code=")) {
      const fakeUrl = new URL(`https://placeholder.test/?${trimmed.replace(/^[^?]*\??/, "")}`);
      code = fakeUrl.searchParams.get("code");
      returnedState = fakeUrl.searchParams.get("state");
    }
  }

  if (!code) {
    console.error("Could not find ?code=... in the pasted value.");
    process.exit(1);
  }
  if (returnedState !== state) {
    console.error(`State mismatch — expected ${state}, got ${returnedState}. Possible CSRF; aborting.`);
    process.exit(1);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);

  console.log("\nExchanging code for tokens...");
  const res = await fetch(BUNGIE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-Key": config.apiKey,
    },
    body,
  });

  if (!res.ok) {
    console.error(`Token exchange failed: ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(1);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    membership_id: string;
  };

  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    refresh_expires_in: data.refresh_expires_in,
    membership_id: data.membership_id,
    obtained_at: Date.now(),
  });

  console.log(`\nSuccess. Tokens saved to ${TOKENS_PATH}`);
  console.log(`  access_token expires in ~${Math.floor(data.expires_in / 60)} min`);
  console.log(`  refresh_token expires in ~${Math.floor(data.refresh_expires_in / 86400)} days`);
  console.log(`  bungie membership_id: ${data.membership_id}\n`);
  console.log("Next: npm run derive");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
