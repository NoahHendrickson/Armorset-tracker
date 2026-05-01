import Link from "next/link";
import { Shield, SignOut } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface AppHeaderProps {
  displayName: string;
}

export function AppHeader({ displayName }: AppHeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Shield weight="fill" className="h-5 w-5" />
          Armor Set Checklist
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {displayName}
          </span>
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/api/auth/logout">
              <SignOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
