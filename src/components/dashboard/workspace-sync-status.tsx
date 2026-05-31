"use client";

import {
  createContext,
  useCallback,
  useContext,
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

  const registerRetry = useCallback((fn: (() => void) | null) => {
    setRetryFn(() => fn);
  }, []);

  const retrySync = useCallback(() => {
    retryFn?.();
  }, [retryFn]);

  const value = useMemo(
    () => ({
      health,
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
    }),
    [
      health,
      phase,
      manifestError,
      inventoryError,
      inventoryWarnings,
      reauthMessage,
      registerRetry,
      retrySync,
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
