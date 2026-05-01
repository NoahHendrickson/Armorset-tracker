import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkle, Warning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

interface HomePageProps {
  searchParams: Promise<{ auth_error?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const { auth_error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <Sparkle className="h-3.5 w-3.5" weight="fill" />
            Armor 3.0 set tracking
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Track every armor set you&rsquo;re chasing.
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg">
            Replace the spreadsheet. Sign in with Bungie, define your target
            (set &times; archetype &times; tuning), and see exactly which
            pieces you own across every character and the vault.
          </p>
        </div>

        {auth_error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            <Warning weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Couldn&rsquo;t complete sign-in: {auth_error}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg">
            <Link href="/api/auth/bungie/login">
              Sign in with Bungie
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a
              href="https://www.bungie.net"
              target="_blank"
              rel="noreferrer"
            >
              About Bungie OAuth
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Read-only access. We only request your inventory and vault &mdash;
          never write to your account.
        </p>
      </div>
    </main>
  );
}
