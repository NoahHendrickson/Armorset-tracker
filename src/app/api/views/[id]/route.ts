import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getServiceRoleClient } from "@/lib/db/server";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  set_hash: z.coerce.number().int().optional(),
  archetype_hash: z.coerce.number().int().optional(),
  tuning_hash: z.coerce.number().int().optional(),
  class_type: z.coerce.number().int().min(0).max(2).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("views")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ view: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  const sb = getServiceRoleClient();
  const { error } = await sb
    .from("views")
    .delete()
    .eq("user_id", session.userId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
