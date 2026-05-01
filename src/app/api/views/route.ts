import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";
import { listViewsForUser } from "@/lib/views/queries";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  set_hash: z.coerce.number().int(),
  archetype_hash: z.coerce.number().int(),
  tuning_hash: z.coerce.number().int(),
  // Bungie's classType convention: 0 Titan, 1 Hunter, 2 Warlock.
  class_type: z.coerce.number().int().min(0).max(2),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const views = await listViewsForUser(session.userId);
  return NextResponse.json({ views });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("views")
    .insert({
      user_id: session.userId,
      name: parsed.data.name.trim(),
      set_hash: parsed.data.set_hash,
      archetype_hash: parsed.data.archetype_hash,
      tuning_hash: parsed.data.tuning_hash,
      class_type: parsed.data.class_type,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Insert failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ view: data }, { status: 201 });
}
