"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SerializableTrackerPayload } from "@/lib/workspace/types";
import type { WorkspaceLayoutJson } from "@/lib/workspace/workspace-schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OptionItem {
  hash: number;
  name: string;
}

type ClassValue = "0" | "1" | "2";

interface NewViewFormProps {
  setsByClass: { 0: OptionItem[]; 1: OptionItem[]; 2: OptionItem[] };
  archetypes: OptionItem[];
  tunings: OptionItem[];
  /** Dialog / canvas mode — no navigation after save. */
  embedded?: boolean;
  /** When set, the form is addressable by external submit controls via the `form` attribute. */
  formId?: string;
  /** Hide the inline submit button (use with `formId` and an external submit control). */
  externalSubmit?: boolean;
  /** Persisted tracker frame on creation (canvas placement). */
  initialLayout?: WorkspaceLayoutJson;
  /** Includes `tracker` when the API returns workspace payload so the dashboard can merge without refetching. */
  onCreated?: (viewId: string, tracker?: SerializableTrackerPayload) => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** Fires when embedded “Create” via external submit becomes allowed (all required fields + not busy). */
  onCanSubmitChange?: (canSubmit: boolean) => void;
}

const CLASS_OPTIONS: Array<{ value: ClassValue; label: string }> = [
  { value: "0", label: "Titan" },
  { value: "1", label: "Hunter" },
  { value: "2", label: "Warlock" },
];

export function NewViewForm({
  setsByClass,
  archetypes,
  tunings,
  embedded,
  formId,
  externalSubmit,
  initialLayout,
  onCreated,
  onCancel,
  onBusyChange,
  onCanSubmitChange,
}: NewViewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onBusyChange?.(submitting || isPending);
  }, [submitting, isPending, onBusyChange]);

  const [name, setName] = useState("");
  const [classType, setClassType] = useState<ClassValue | "">("");
  const [setHash, setSetHash] = useState<string>("");
  const [archetypeHash, setArchetypeHash] = useState<string>("");
  const [tuningHash, setTuningHash] = useState<string>("");

  const sortedSets = useMemo(() => {
    if (classType === "") return [];
    return setsByClass[Number(classType) as 0 | 1 | 2];
  }, [classType, setsByClass]);

  const sortedArchetypes = useMemo(
    () => [...archetypes].sort((a, b) => a.name.localeCompare(b.name)),
    [archetypes],
  );
  const sortedTunings = useMemo(
    () => [...tunings].sort((a, b) => a.name.localeCompare(b.name)),
    [tunings],
  );

  const setLabel =
    sortedSets.find((s) => String(s.hash) === setHash)?.name ?? "";
  const archetypeLabel =
    sortedArchetypes.find((a) => String(a.hash) === archetypeHash)?.name ?? "";
  const classLabel =
    CLASS_OPTIONS.find((c) => c.value === classType)?.label ?? "";

  const canSubmit =
    name.trim().length > 0 &&
    classType !== "" &&
    setHash !== "" &&
    archetypeHash !== "" &&
    tuningHash !== "" &&
    !submitting;

  const canSubmitWithTransition = canSubmit && !isPending;

  useEffect(() => {
    onCanSubmitChange?.(canSubmitWithTransition);
  }, [canSubmitWithTransition, onCanSubmitChange]);

  function autoFillName() {
    if (!name && setLabel && archetypeLabel && classLabel) {
      setName(`${classLabel} ${setLabel} — ${archetypeLabel}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          set_hash: Number(setHash),
          archetype_hash: Number(archetypeHash),
          tuning_hash: Number(tuningHash),
          class_type: Number(classType),
          ...(initialLayout !== undefined ? { layout: initialLayout } : {}),
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        view?: { id: string };
        tracker?: SerializableTrackerPayload;
      };
      if (!res.ok || !body.view) {
        toast.error(body.error ?? "Could not create view");
        return;
      }
      toast.success(embedded ? "Tracker created" : "View created");
      if (onCreated) {
        startTransition(() => onCreated(body.view!.id, body.tracker));
      } else if (!embedded) {
        startTransition(() => router.push(`/views/${body.view!.id}`));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create view");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="class">Class</Label>
        <Select
          value={classType}
          onValueChange={(v) => {
            const nv = v as ClassValue;
            const nextSorted = setsByClass[nv];
            setClassType(nv);
            setSetHash((prev) =>
              prev && nextSorted.some((s) => String(s.hash) === prev)
                ? prev
                : "",
            );
          }}
        >
          <SelectTrigger id="class" aria-label="Class">
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {CLASS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="set">Armor set</Label>
        <Select
          value={setHash}
          onValueChange={(v) => setSetHash(v)}
          disabled={classType === ""}
        >
          <SelectTrigger id="set" aria-label="Armor set">
            <SelectValue
              placeholder={
                classType === ""
                  ? "Pick a class first"
                  : "Select an armor set"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {sortedSets.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                {classType === ""
                  ? "Pick a class first."
                  : "No sets available — sync the manifest first."}
              </div>
            ) : (
              sortedSets.map((s) => (
                <SelectItem key={s.hash} value={String(s.hash)}>
                  {s.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="archetype">Archetype</Label>
        <Select
          value={archetypeHash}
          onValueChange={(v) => {
            setArchetypeHash(v);
          }}
        >
          <SelectTrigger id="archetype" aria-label="Archetype">
            <SelectValue placeholder="Select an archetype" />
          </SelectTrigger>
          <SelectContent>
            {sortedArchetypes.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No archetypes available — sync the manifest first.
              </div>
            ) : (
              sortedArchetypes.map((a) => (
                <SelectItem key={a.hash} value={String(a.hash)}>
                  {a.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tuning">Tuning stat</Label>
        <Select
          value={tuningHash}
          onValueChange={(v) => {
            setTuningHash(v);
          }}
        >
          <SelectTrigger id="tuning" aria-label="Tuning stat">
            <SelectValue placeholder="Select a tuning stat" />
          </SelectTrigger>
          <SelectContent>
            {sortedTunings.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No tunings available — sync the manifest first.
              </div>
            ) : (
              sortedTunings.map((t) => (
                <SelectItem key={t.hash} value={String(t.hash)}>
                  {t.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">{embedded ? "Tracker name" : "View name"}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={autoFillName}
          placeholder='e.g. "Warlock Ferropotent — Gunner"'
          maxLength={80}
          required
        />
        <p className="text-xs text-muted-foreground">
          Shown on your dashboard. Defaults to class + set + archetype.
        </p>
      </div>

      <div
        className={`flex gap-3 pt-2 ${embedded && externalSubmit ? "justify-start" : "items-center justify-between"}`}
      >
        {embedded && onCancel ? (
          <Button variant="ghost" type="button" onClick={() => onCancel()}>
            <ArrowLeft weight="duotone" />
            Cancel
          </Button>
        ) : (
          <Button asChild variant="ghost" type="button">
            <Link href="/dashboard">
              <ArrowLeft weight="duotone" />
              Cancel
            </Link>
          </Button>
        )}
        {!externalSubmit ? (
          <Button type="submit" disabled={!canSubmit || isPending}>
            <FloppyDisk weight="duotone" />
            {submitting || isPending
              ? "Saving..."
              : embedded
                ? "Create tracker"
                : "Create view"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
