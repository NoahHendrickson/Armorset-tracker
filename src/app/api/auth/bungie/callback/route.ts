import { NextResponse, type NextRequest } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/bungie/oauth";
import { getMembershipDataForCurrentUser } from "@/lib/bungie/client";
import { getServiceRoleClient } from "@/lib/db/server";
import { signSessionJwt } from "@/lib/auth/session";
import {
  BUNGIE_OAUTH_STATE_COOKIE,
  bungieOAuthStateCookieOptions,
} from "@/lib/auth/bungie-oauth-cookies";
import { bungieOAuthRedirectUri } from "@/lib/auth/bungie-redirect-uri";
import { requestCookieValue } from "@/lib/auth/request-cookie";
import { persistTokens } from "@/lib/auth/tokens";
import { profilePictureRelPathFromMembership } from "@/lib/bungie/profile-picture";

function clearOauthStateCookie(res: NextResponse) {
  res.cookies.set(
    BUNGIE_OAUTH_STATE_COOKIE,
    "",
    bungieOAuthStateCookieOptions(0),
  );
}

function redirectWithError(req: NextRequest, message: string) {
  const dest = new URL("/", req.url);
  dest.searchParams.set("auth_error", message);
  const res = NextResponse.redirect(dest, 303);
  clearOauthStateCookie(res);
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const expectedState = requestCookieValue(req, BUNGIE_OAUTH_STATE_COOKIE);

  if (error) {
    return redirectWithError(req, `Bungie returned error: ${error}`);
  }
  if (!code || !state) {
    return redirectWithError(req, "Missing code or state in OAuth callback");
  }
  if (!expectedState || expectedState !== state) {
    return redirectWithError(
      req,
      "OAuth state mismatch — possible CSRF, please try again",
    );
  }

  const redirectUri = bungieOAuthRedirectUri(req);

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode(code, redirectUri);
  } catch (err) {
    return redirectWithError(
      req,
      err instanceof Error ? err.message : "Token exchange failed",
    );
  }

  let membership;
  try {
    membership = await getMembershipDataForCurrentUser(tokens.access_token);
  } catch (err) {
    return redirectWithError(
      req,
      err instanceof Error ? err.message : "Failed to load Bungie membership",
    );
  }

  const primary =
    membership.destinyMemberships.find(
      (m) => m.membershipId === membership.primaryMembershipId,
    ) ?? membership.destinyMemberships[0];

  if (!primary) {
    return redirectWithError(
      req,
      "No Destiny memberships are linked to this Bungie account.",
    );
  }

  const profilePicturePath = profilePictureRelPathFromMembership(membership);

  const sb = getServiceRoleClient();
  const { data: existing } = await sb
    .from("users")
    .select("*")
    .eq("bungie_membership_id", primary.membershipId)
    .maybeSingle();

  let user = existing;
  if (!user) {
    const { data: inserted, error: insertErr } = await sb
      .from("users")
      .insert({
        bungie_membership_id: primary.membershipId,
        bungie_membership_type: primary.membershipType,
        display_name:
          primary.bungieGlobalDisplayName ??
          primary.displayName ??
          membership.bungieNetUser.displayName,
        profile_picture_path: profilePicturePath,
      })
      .select("*")
      .single();
    if (insertErr || !inserted) {
      return redirectWithError(
        req,
        `Failed to create user: ${insertErr?.message ?? "unknown"}`,
      );
    }
    user = inserted;
  } else {
    const newName =
      primary.bungieGlobalDisplayName ??
      primary.displayName ??
      membership.bungieNetUser.displayName;
    const picChanged =
      (user.profile_picture_path ?? null) !== (profilePicturePath ?? null);
    if (
      user.display_name !== newName ||
      user.bungie_membership_type !== primary.membershipType ||
      picChanged
    ) {
      await sb
        .from("users")
        .update({
          display_name: newName,
          bungie_membership_type: primary.membershipType,
          profile_picture_path: profilePicturePath,
        })
        .eq("id", user.id);
    }
  }

  try {
    await persistTokens(user.id, tokens);
  } catch (err) {
    return redirectWithError(
      req,
      err instanceof Error ? err.message : "Failed to store tokens",
    );
  }

  // Cookie cannot be set directly on this response: empirically, Chrome
  // refuses to persist Set-Cookie set on a callback response that was
  // reached via cross-site top-level navigation from bungie.net, even with
  // canonical attributes (verified end-to-end via /api/debug/auth across
  // SameSite=None/Lax, 200/303/307, single/multi Set-Cookie, with/without
  // Expires). The state cookie set by /api/auth/bungie/login persists fine
  // because that request is initiated by an in-origin click.
  //
  // Workaround: render an HTML interstitial that POSTs the freshly-signed
  // JWT to /api/auth/install via same-origin fetch. The install route's
  // Set-Cookie is on a same-origin AJAX response, which the browser stores
  // without any cross-site/redirect heuristic interference. The page then
  // navigates to /dashboard.
  const jwt = await signSessionJwt(user);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Signing you in</title>
<meta name="robots" content="noindex,nofollow">
<style>html,body{margin:0;height:100%;background:#0b0b0c;color:#e6e6e6;font-family:system-ui,-apple-system,sans-serif}body{display:flex;align-items:center;justify-content:center}p{font-size:14px;opacity:.7}</style>
</head>
<body>
<p>Signing you in&hellip;</p>
<script>
(function(){
  var t=${JSON.stringify(jwt)};
  fetch("/api/auth/install",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({t:t})})
    .then(function(r){
      if(r.ok){location.replace("/dashboard");return;}
      r.text().then(function(b){location.replace("/?auth_error="+encodeURIComponent("Install failed: "+r.status+" "+b));});
    })
    .catch(function(e){location.replace("/?auth_error="+encodeURIComponent(String(e&&e.message||e)));});
})();
</script>
<noscript><p>JavaScript is required to complete sign-in. <a style="color:#9bf" href="/api/auth/bungie/login">Try again</a>.</p></noscript>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
