import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

export default function ViewNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">View not found</h1>
      <p className="text-sm text-muted-foreground">
        This view doesn&rsquo;t exist or has been deleted.
      </p>
      <Button asChild>
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>
    </main>
  );
}
