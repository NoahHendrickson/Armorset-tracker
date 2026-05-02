import { NextResponse, type NextRequest } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/bungie/oauth";
import { getMembershipDataForCurrentUser } from "@/lib/bungie/client";
import { getServiceRoleClient } from "@/lib/db/server";
import {
  setSessionCookieOnResponse,
} from "@/lib/auth/session";
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

  // Canonical OAuth callback: 303 See Other → /dashboard with Set-Cookie.
  // We deliberately emit only ONE Set-Cookie on this response (the session)
  // rather than additionally clearing the OAuth state cookie here — multiple
  // Set-Cookie headers on a 3xx redirect were getting mangled in transit on
  // Vercel and the session cookie wasn't landing. The state cookie's
  // 30-minute Max-Age handles cleanup; the login route also overwrites it
  // by name on the next sign-in.
  const dest = new URL("/dashboard", req.url);
  const res = NextResponse.redirect(dest, 303);
  res.headers.set("Cache-Control", "no-store");
  await setSessionCookieOnResponse(res, user);
  return res;
}
