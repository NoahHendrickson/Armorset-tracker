import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { MOCK_PAYLOAD_TITAN_PARTIAL } from "../../../.storybook/mocks/tracker-payload";
import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";

import { Button } from "@/components/ui/button";
import { DuplicateTrackerDialog } from "./duplicate-tracker-dialog";

const meta: Meta<typeof DuplicateTrackerDialog> = {
  title: "Workspace/DuplicateTrackerDialog",
  component: DuplicateTrackerDialog,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
};
export default meta;

type Story = StoryObj<typeof DuplicateTrackerDialog>;

export const Open: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="flex min-h-[28rem] items-center justify-center">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          aria-pressed={open}
        >
          Re-open dialog
        </Button>
        <DuplicateTrackerDialog
          source={open ? MOCK_PAYLOAD_TITAN_PARTIAL : null}
          onOpenChange={(next) => setOpen(next)}
          selectors={MOCK_TRACKER_FORM_SELECTORS}
          onCreated={() => setOpen(false)}
        />
      </div>
    );
  },
};
