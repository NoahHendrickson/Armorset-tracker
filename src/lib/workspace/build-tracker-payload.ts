import "server-only";

import type { DerivedArmorPieceJson, ViewRow } from "@/lib/db/types";
import type { ManifestLookups } from "@/lib/manifest/lookups";
import { resolveViewSetHash } from "@/lib/manifest/lookups";
import { buildGridLookupPayload } from "@/lib/views/grid-lookup-payload.server";
import { assembleTrackerPayloadFromLookup } from "@/lib/workspace/build-tracker-payload-core";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import { parseWorkspaceLayout } from "@/lib/workspace/workspace-schema";

/** Build one tracker card payload after DB view row + manifest + inventory snapshot. */
export function buildSerializableTrackerPayload(
  viewRow: ViewRow,
  lookups: ManifestLookups,
  inventory: DerivedArmorPieceJson[],
): SerializableTrackerPayload {
  const resolvedSetHash = resolveViewSetHash(Number(viewRow.set_hash), lookups);
  const lookupPayload = buildGridLookupPayload(lookups);

  return assembleTrackerPayloadFromLookup(
    { ...viewRow, layout: parseWorkspaceLayout(viewRow.layout) },
    resolvedSetHash,
    inventory,
    lookupPayload,
  );
}
