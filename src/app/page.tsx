import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { SignIn, Warning } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import {
  NEW_TRACKER_FAB_CLASSES,
  NEW_TRACKER_FAB_SHADOW,
} from "@/components/workspace/new-tracker-fab-styles";
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
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-auto bg-[#1a1b1b] px-6 py-16 text-white">
      <div className="mx-auto flex w-full max-w-[min(100%,52rem)] flex-col items-center gap-10 lg:w-fit lg:max-w-none lg:flex-row lg:items-center lg:gap-8 xl:gap-10">
        <Image
          src="/skull.svg"
          alt=""
          width={272}
          height={384}
          priority
          unoptimized
          className="pixel-art-img h-[96px] w-auto shrink-0 sm:h-[144px] lg:h-[192px]"
        />

        <div className="flex w-full max-w-md flex-col items-start gap-6 text-left sm:max-w-xl lg:w-auto lg:max-w-[778px] lg:gap-10">
          <div className="flex flex-col items-start gap-2 lg:gap-2.5">
            <h1 className="text-base font-normal leading-snug tracking-tight text-white/70 sm:text-lg lg:text-xl">
              D2 Tuning Tracker
            </h1>
            <p className="text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl lg:text-[28px] lg:leading-snug">
              Make a tracker for a certain
              <br />
              armor set, archtype and tuning
            </p>
          </div>

          {auth_error ? (
            <div
              role="alert"
              className="flex w-full items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
            >
              <Warning weight="duotone" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Couldn&rsquo;t complete sign-in: {auth_error}</span>
            </div>
          ) : null}

          <Button asChild className={NEW_TRACKER_FAB_CLASSES} style={NEW_TRACKER_FAB_SHADOW}>
            <Link href="/api/auth/bungie/login">
              Sign in with Bungie
              <SignIn weight="duotone" className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
