"use client";

import {
  createContext,
  useContext,
  type MutableRefObject,
} from "react";

/** Live canvas zoom for react-rnd — updated every transform tick without React renders. */
export const WorkspaceZoomScaleRefContext =
  createContext<MutableRefObject<number> | null>(null);

export function useWorkspaceZoomScaleRef(): MutableRefObject<number> {
  const ref = useContext(WorkspaceZoomScaleRefContext);
  if (!ref) {
    throw new Error(
      "useWorkspaceZoomScaleRef must be used under WorkspaceZoomScaleRefContext.Provider",
    );
  }
  return ref;
}
