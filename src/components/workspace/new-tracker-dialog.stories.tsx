import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { MOCK_TRACKER_FORM_SELECTORS } from "../../../.storybook/mocks/tracker-options";

import { NewTrackerDialog } from "./new-tracker-dialog";

const meta: Meta<typeof NewTrackerDialog> = {
  title: "Workspace/NewTrackerDialog",
  component: NewTrackerDialog,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
};
export default meta;

type Story = StoryObj<typeof NewTrackerDialog>;

export const Closed: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex min-h-[14rem] items-center justify-center">
        <NewTrackerDialog
          open={open}
          onOpenChange={setOpen}
          selectors={MOCK_TRACKER_FORM_SELECTORS}
          onCreated={() => setOpen(false)}
        />
      </div>
    );
  },
};

export const ManifestEmpty: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <NewTrackerDialog
          open={open}
          onOpenChange={setOpen}
          selectors={{
            ...MOCK_TRACKER_FORM_SELECTORS,
            manifestEmpty: true,
          }}
          onCreated={() => setOpen(false)}
        />
      </div>
    );
  },
};
