"use client";

import { toast } from "sonner";
import {
  BUNGIE_REAUTH_TOAST_ID,
  BUNGIE_REAUTH_USER_MESSAGE,
  BUNGIE_RECONNECT_PATH,
} from "@/lib/auth/bungie-reauth";

const bungieReconnectToastDefaults = {
  id: BUNGIE_REAUTH_TOAST_ID,
  duration: 22_000,
  style: { borderRadius: 0 },
  classNames: {
    toast: "rounded-none",
    actionButton: "rounded-none",
  },
} as const;

export function showBungieReconnectToast(
  message: string | undefined = BUNGIE_REAUTH_USER_MESSAGE,
  reconnectPath: string | undefined = BUNGIE_RECONNECT_PATH,
  actionLabel = "Reconnect Bungie",
) {
  toast.error(message ?? BUNGIE_REAUTH_USER_MESSAGE, {
    ...bungieReconnectToastDefaults,
    action: {
      label: actionLabel,
      onClick: () => {
        window.location.href = reconnectPath ?? BUNGIE_RECONNECT_PATH;
      },
    },
  });
}
