import "server-only";

import { randomBytes } from "node:crypto";
import { getServiceRoleClient } from "@/lib/db/server";
import type { SavedFilterViewRow } from "@/lib/db/types";
import {
  parseSavedFilterViewPayload,
  type SavedFilterViewPayload,
} from "@/lib/saved-views/schema";

/** Legacy column — filters-only saved views no longer use workspace mode. */
const LEGACY_VIEW_MODE = "grid";

const SHARE_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const SHARE_SLUG_LEN = 12;

function randomShareSlug(): string {
  const bytes = randomBytes(SHARE_SLUG_LEN);
  let out = "";
  for (let i = 0; i < SHARE_SLUG_LEN; i++) {
    out += SHARE_SLUG_ALPHABET[bytes[i]! % SHARE_SLUG_ALPHABET.length]!;
  }
  return out;
}

export async function listSavedViewsForUser(
  userId: string,
): Promise<SavedFilterViewRow[]> {
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("saved_filter_views")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`listSavedViewsForUser failed: ${error.message}`);
  }
  return (data ?? []) as SavedFilterViewRow[];
}

export async function getSavedViewForUser(
  userId: string,
  id: string,
): Promise<SavedFilterViewRow | null> {
  const sb = getServiceRoleClient();
  const { data } = await sb
    .from("saved_filter_views")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return (data as SavedFilterViewRow) ?? null;
}

export async function createSavedView(
  userId: string,
  input: {
    name: string;
    filters: SavedFilterViewPayload;
  },
): Promise<SavedFilterViewRow> {
  const sb = getServiceRoleClient();
  const trimmedName = input.name.trim();
  const { data, error } = await sb
    .from("saved_filter_views")
    .insert({
      user_id: userId,
      name: trimmedName,
      filters: input.filters,
      view_mode: LEGACY_VIEW_MODE,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`createSavedView failed: ${error?.message ?? "unknown"}`);
  }
  return data as SavedFilterViewRow;
}

export async function renameSavedView(
  userId: string,
  id: string,
  name: string,
): Promise<SavedFilterViewRow | null> {
  const sb = getServiceRoleClient();
  const { data: existing } = await sb
    .from("saved_filter_views")
    .select("id, source_user_id")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.source_user_id !== null) {
    return null;
  }

  const { data, error } = await sb
    .from("saved_filter_views")
    .update({
      name: name.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    throw new Error(`renameSavedView failed: ${error.message}`);
  }
  return (data as SavedFilterViewRow) ?? null;
}

export async function deleteSavedView(
  userId: string,
  id: string,
): Promise<boolean> {
  const sb = getServiceRoleClient();
  const { error, count } = await sb
    .from("saved_filter_views")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) {
    throw new Error(`deleteSavedView failed: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export async function ensureShareSlug(
  userId: string,
  id: string,
): Promise<SavedFilterViewRow | null> {
  const sb = getServiceRoleClient();
  const { data: row } = await sb
    .from("saved_filter_views")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (!row || row.source_user_id !== null) {
    return null;
  }
  if (row.share_slug) {
    return row as SavedFilterViewRow;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = randomShareSlug();
    const { data, error } = await sb
      .from("saved_filter_views")
      .update({
        share_slug: slug,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", id)
      .is("share_slug", null)
      .select("*")
      .maybeSingle();
    if (!error && data) {
      return data as SavedFilterViewRow;
    }
    if (error?.code !== "23505") {
      throw new Error(`ensureShareSlug failed: ${error?.message ?? "unknown"}`);
    }
  }
  throw new Error("ensureShareSlug failed: could not allocate unique slug");
}

export async function revokeShareSlug(
  userId: string,
  id: string,
): Promise<SavedFilterViewRow | null> {
  const sb = getServiceRoleClient();
  const { data: existing } = await sb
    .from("saved_filter_views")
    .select("id, source_user_id")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.source_user_id !== null) {
    return null;
  }

  const { data, error } = await sb
    .from("saved_filter_views")
    .update({
      share_slug: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    throw new Error(`revokeShareSlug failed: ${error.message}`);
  }
  return (data as SavedFilterViewRow) ?? null;
}

export async function importSharedView(
  recipientUserId: string,
  slug: string,
): Promise<SavedFilterViewRow | null> {
  const sb = getServiceRoleClient();

  const { data: existingImport } = await sb
    .from("saved_filter_views")
    .select("*")
    .eq("user_id", recipientUserId)
    .eq("source_share_slug", slug)
    .maybeSingle();
  if (existingImport) {
    return existingImport as SavedFilterViewRow;
  }

  const { data: source } = await sb
    .from("saved_filter_views")
    .select("*")
    .eq("share_slug", slug)
    .is("source_user_id", null)
    .maybeSingle();
  if (!source) {
    return null;
  }

  const sourcePayload = parseSavedFilterViewPayload(source.filters);
  if (!sourcePayload) {
    return null;
  }

  const { data: sourceUser } = await sb
    .from("users")
    .select("display_name")
    .eq("id", source.user_id)
    .maybeSingle();

  const { data: inserted, error } = await sb
    .from("saved_filter_views")
    .insert({
      user_id: recipientUserId,
      name: source.name,
      filters: sourcePayload,
      view_mode: source.view_mode,
      source_user_id: source.user_id,
      source_display_name: sourceUser?.display_name ?? "Unknown Guardian",
      source_share_slug: slug,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await sb
        .from("saved_filter_views")
        .select("*")
        .eq("user_id", recipientUserId)
        .eq("source_share_slug", slug)
        .maybeSingle();
      return (raced as SavedFilterViewRow) ?? null;
    }
    throw new Error(`importSharedView failed: ${error.message}`);
  }

  return (inserted as SavedFilterViewRow) ?? null;
}
