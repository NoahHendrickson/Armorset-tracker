"use client";

import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-none group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:rounded-none group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-none group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "rounded-none",
        },
      }}
      {...props}
    />
  );
}
