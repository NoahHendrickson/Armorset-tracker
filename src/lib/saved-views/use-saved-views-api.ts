"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { SavedFilterViewRow } from "@/lib/db/types";
import type { GridFiltersJson } from "@/lib/workspace/grid-filters-schema";
import { payloadFromGridFilters } from "@/lib/saved-views/schema";

function sortByName(views: SavedFilterViewRow[]): SavedFilterViewRow[] {
  return [...views].sort((a, b) => a.name.localeCompare(b.name));
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${fallback} (${res.status})`;
}

export function useSavedViewsApi(
  views: SavedFilterViewRow[],
  onViewsChange: (views: SavedFilterViewRow[]) => void,
) {
  const createView = useCallback(
    async (name: string, filters: GridFiltersJson): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const res = await fetch("/api/saved-views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            filters: payloadFromGridFilters(filters),
          }),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, "Save failed"));
        }
        const body = (await res.json()) as { view: SavedFilterViewRow };
        onViewsChange(sortByName([...views, body.view]));
        toast.success("View saved.");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save view.");
        return false;
      }
    },
    [onViewsChange, views],
  );

  const renameView = useCallback(
    async (view: SavedFilterViewRow, name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const res = await fetch(`/api/saved-views/${view.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, "Rename failed"));
        }
        const body = (await res.json()) as { view: SavedFilterViewRow };
        onViewsChange(
          sortByName(views.map((v) => (v.id === body.view.id ? body.view : v))),
        );
        toast.success("View renamed.");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not rename view.",
        );
        return false;
      }
    },
    [onViewsChange, views],
  );

  const deleteView = useCallback(
    async (view: SavedFilterViewRow): Promise<void> => {
      try {
        const res = await fetch(`/api/saved-views/${view.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, "Delete failed"));
        }
        onViewsChange(views.filter((v) => v.id !== view.id));
        toast.success(
          view.source_user_id === null
            ? "View deleted."
            : "Removed from your list.",
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete view.",
        );
      }
    },
    [onViewsChange, views],
  );

  const ensureShareLink = useCallback(
    async (view: SavedFilterViewRow): Promise<string | null> => {
      try {
        const res = await fetch(`/api/saved-views/${view.id}/share`, {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, "Share failed"));
        }
        const body = (await res.json()) as { slug: string; url: string };
        onViewsChange(
          views.map((v) =>
            v.id === view.id ? { ...v, share_slug: body.slug } : v,
          ),
        );
        return body.url;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not create share link.",
        );
        return null;
      }
    },
    [onViewsChange, views],
  );

  const revokeShareLink = useCallback(
    async (view: SavedFilterViewRow): Promise<boolean> => {
      try {
        const res = await fetch(`/api/saved-views/${view.id}/share`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(await readApiError(res, "Revoke failed"));
        }
        onViewsChange(
          views.map((v) => (v.id === view.id ? { ...v, share_slug: null } : v)),
        );
        toast.success("Share link revoked.");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not revoke share link.",
        );
        return false;
      }
    },
    [onViewsChange, views],
  );

  return {
    createView,
    renameView,
    deleteView,
    ensureShareLink,
    revokeShareLink,
  };
}

export function isOwnedSavedView(view: SavedFilterViewRow): boolean {
  return view.source_user_id === null;
}
