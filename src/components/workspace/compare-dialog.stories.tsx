import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import {
  CompareDialog,
  type CompareTrackerDescriptor,
} from "./compare-dialog";
import { Button } from "@/components/ui/button";
import { MOCK_GRID_LOOKUP_PAYLOAD } from "../../../.storybook/mocks/grid-lookup";
import {
  MOCK_ARCHETYPES,
  MOCK_ARMOR_SETS,
  MOCK_TUNINGS,
} from "../../../.storybook/mocks/manifest-lookups";

const meta: Meta<typeof CompareDialog> = {
  title: "Workspace/CompareDialog",
  component: CompareDialog,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof CompareDialog>;

function buildPool(): CompareTrackerDescriptor[] {
  const pool: CompareTrackerDescriptor[] = [];
  for (const s of MOCK_ARMOR_SETS) {
    for (const a of MOCK_ARCHETYPES) {
      for (const t of MOCK_TUNINGS) {
        pool.push({
          setHash: s.set_hash,
          archetypeHash: a.archetype_hash,
          tuningHash: t.tuning_hash,
          classType: 0,
          setName: s.name,
          archetypeName: a.name,
          tuningName: t.name,
        });
      }
    }
  }
  return pool;
}

const POOL = buildPool();
const ANCHOR = POOL[0]!;

export const PartnerNotYetPicked: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open compare dialog</Button>
        <CompareDialog
          open={open}
          onOpenChange={setOpen}
          anchor={ANCHOR}
          candidatePool={POOL}
          lookupPayload={MOCK_GRID_LOOKUP_PAYLOAD}
          inventory={[]}
          hasInventory={false}
        />
      </>
    );
  },
};
