import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { exchangeAuthorizationCode } from "@/lib/bungie/oauth";
import { getMembershipDataForCurrentUser } from "@/lib/bungie/client";
import { getServiceRoleClient } from "@/lib/db/server";
import { createSessionCookie } from "@/lib/auth/session";
import { persistTokens } from "@/lib/auth/tokens";
import { clientEnv } from "@/lib/env";

const STATE_COOKIE = "armor_checklist_oauth_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const c = await cookies();
  const expectedState = c.get(STATE_COOKIE)?.value;
  c.set({ name: STATE_COOKIE, value: "", path: "/", maxAge: 0 });

  if (error) {
    return redirectWithError(`Bungie returned error: ${error}`);
  }
  if (!code || !state) {
    return redirectWithError("Missing code or state in OAuth callback");
  }
  if (!expectedState || expectedState !== state) {
    return redirectWithError("OAuth state mismatch — possible CSRF, please try again");
  }

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode(code);
  } catch (err) {
    return redirectWithError(
      err instanceof Error ? err.message : "Token exchange failed",
    );
  }

  let membership;
  try {
    membership = await getMembershipDataForCurrentUser(tokens.access_token);
  } catch (err) {
    return redirectWithError(
      err instanceof Error ? err.message : "Failed to load Bungie membership",
    );
  }

  const primary =
    membership.destinyMemberships.find(
      (m) => m.membershipId === membership.primaryMembershipId,
    ) ?? membership.destinyMemberships[0];

  if (!primary) {
    return redirectWithError(
      "No Destiny memberships are linked to this Bungie account.",
    );
  }

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
      })
      .select("*")
      .single();
    if (insertErr || !inserted) {
      return redirectWithError(
        `Failed to create user: ${insertErr?.message ?? "unknown"}`,
      );
    }
    user = inserted;
  } else {
    const newName =
      primary.bungieGlobalDisplayName ??
      primary.displayName ??
      membership.bungieNetUser.displayName;
    if (
      user.display_name !== newName ||
      user.bungie_membership_type !== primary.membershipType
    ) {
      await sb
        .from("users")
        .update({
          display_name: newName,
          bungie_membership_type: primary.membershipType,
        })
        .eq("id", user.id);
    }
  }

  try {
    await persistTokens(user.id, tokens);
  } catch (err) {
    return redirectWithError(
      err instanceof Error ? err.message : "Failed to store tokens",
    );
  }

  await createSessionCookie(user);
  return NextResponse.redirect(new URL("/dashboard", clientEnv().NEXT_PUBLIC_APP_URL));
}

function redirectWithError(message: string) {
  const env = clientEnv();
  const dest = new URL("/", env.NEXT_PUBLIC_APP_URL);
  dest.searchParams.set("auth_error", message);
  return NextResponse.redirect(dest);
}
