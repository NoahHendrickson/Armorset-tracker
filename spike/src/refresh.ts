import { refreshAccessToken } from "./lib/bungie.js";
import { loadConfig, loadTokens, saveTokens, TOKENS_PATH } from "./lib/config.js";

async function main() {
  const config = loadConfig();
  const tokens = loadTokens();
  if (!tokens) {
    console.error(`No tokens found at ${TOKENS_PATH}. Run \`npm run oauth\` first.`);
    process.exit(1);
  }

  console.log("Refreshing access token...");
  const refreshed = await refreshAccessToken(config, tokens.refresh_token);
  saveTokens({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_in: refreshed.expires_in,
    refresh_expires_in: refreshed.refresh_expires_in,
    membership_id: refreshed.membership_id,
    obtained_at: Date.now(),
  });
  console.log("Done. New access_token expires in", Math.floor(refreshed.expires_in / 60), "min");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
