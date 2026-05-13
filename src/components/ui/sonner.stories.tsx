import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";

import { Button } from "./button";
import { Toaster } from "./sonner";

const meta: Meta<typeof Toaster> = {
  title: "UI/Toaster (sonner)",
  component: Toaster,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast("Tracker created")}>Default</Button>
        <Button
          variant="secondary"
          onClick={() => toast.success("Inventory refreshed")}
        >
          Success
        </Button>
        <Button
          variant="destructive"
          onClick={() => toast.error("Failed to refresh inventory")}
        >
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.warning(
              "Bungie returned only equipped items. Re-grant the inventory scope.",
              { duration: 8000 },
            )
          }
        >
          Warning
        </Button>
      </div>
      <Toaster />
    </div>
  ),
};
