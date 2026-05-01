import { redirect } from "next/navigation";

interface ViewRedirectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewRedirectPage({ params }: ViewRedirectPageProps) {
  const { id } = await params;
  redirect(`/dashboard?tracker=${encodeURIComponent(id)}`);
}
