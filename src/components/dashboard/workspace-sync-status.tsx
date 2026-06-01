"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  WorkspaceDataHealth,
  WorkspaceSyncPhase,
} from "@/lib/workspace/workspace-data-health.shared";

interface WorkspaceSyncContextValue {
  health: WorkspaceDataHealth;
  phase: WorkspaceSyncPhase;
  manifestError: string | null;
  inventoryError: string | null;
  inventoryWarnings: string[];
  reauthMessage: string | null;
  setPhase: (phase: WorkspaceSyncPhase) => void;
  setManifestError: (message: string | null) => void;
  setInventoryError: (message: string | null) => void;
  setInventoryWarnings: (warnings: string[]) => void;
  setReauthMessage: (message: string | null) => void;
  registerRetry: (fn: (() => void) | null) => void;
  retrySync: () => void;
  /** Call after a successful manifest sync so the gate clears before RSC refresh lands. */
  acknowledgeManifestSync: () => void;
}

const WorkspaceSyncContext = createContext<WorkspaceSyncContextValue | null>(
  null,
);

export function WorkspaceSyncProvider({
  health,
  children,
}: {
  health: WorkspaceDataHealth;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<WorkspaceSyncPhase>("idle");
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryWarnings, setInventoryWarnings] = useState<string[]>([]);
  const [reauthMessage, setReauthMessage] = useState<string | null>(null);
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);
  const [manifestSyncAcknowledged, setManifestSyncAcknowledged] = useState(false);

  const registerRetry = useCallback((fn: (() => void) | null) => {
    setRetryFn(() => fn);
  }, []);

  const retrySync = useCallback(() => {
    retryFn?.();
  }, [retryFn]);

  const acknowledgeManifestSync = useCallback(() => {
    setManifestSyncAcknowledged(true);
  }, []);

  const effectiveHealth = useMemo((): WorkspaceDataHealth => {
    if (!manifestSyncAcknowledged || health.manifestReady) {
      return health;
    }
    return {
      ...health,
      manifestReady: true,
      manifestNeedsSync: false,
    };
  }, [health, manifestSyncAcknowledged]);

  useEffect(() => {
    if (health.manifestReady) {
      setManifestSyncAcknowledged(false);
    }
  }, [health.manifestReady]);

  const value = useMemo(
    () => ({
      health: effectiveHealth,
      phase,
      manifestError,
      inventoryError,
      inventoryWarnings,
      reauthMessage,
      setPhase,
      setManifestError,
      setInventoryError,
      setInventoryWarnings,
      setReauthMessage,
      registerRetry,
      retrySync,
      acknowledgeManifestSync,
    }),
    [
      effectiveHealth,
      phase,
      manifestError,
      inventoryError,
      inventoryWarnings,
      reauthMessage,
      registerRetry,
      retrySync,
      acknowledgeManifestSync,
    ],
  );

  return (
    <WorkspaceSyncContext.Provider value={value}>
      {children}
    </WorkspaceSyncContext.Provider>
  );
}

export function useWorkspaceSync(): WorkspaceSyncContextValue {
  const ctx = useContext(WorkspaceSyncContext);
  if (!ctx) {
    throw new Error("useWorkspaceSync must be used within WorkspaceSyncProvider");
  }
  return ctx;
}
