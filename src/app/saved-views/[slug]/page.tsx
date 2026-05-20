import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { importSharedView } from "@/lib/saved-views/queries";

export const dynamic = "force-dynamic";

interface SavedViewImportPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SavedViewImportPage({
  params,
}: SavedViewImportPageProps) {
  const { slug } = await params;
  const returnTo = `/saved-views/${encodeURIComponent(slug)}`;

  const session = await getSession();
  if (!session) {
    redirect(`/?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const imported = await importSharedView(session.userId, slug);
  if (!imported) {
    notFound();
  }

  redirect(
    `/dashboard?savedViewImported=${encodeURIComponent(imported.id)}`,
  );
}
