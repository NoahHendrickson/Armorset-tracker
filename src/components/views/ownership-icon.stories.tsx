import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { OwnershipIcon } from "./ownership-icon";

const meta: Meta<typeof OwnershipIcon> = {
  title: "Views/OwnershipIcon",
  component: OwnershipIcon,
  parameters: { layout: "centered" },
  argTypes: {
    state: {
      control: { type: "inline-radio" },
      options: ["owned", "missing", "loading"],
    },
    count: { control: { type: "number", min: 0, max: 9 } },
  },
};
export default meta;

type Story = StoryObj<typeof OwnershipIcon>;

export const Owned: Story = { args: { state: "owned" } };

export const OwnedDuplicates: Story = { args: { state: "owned", count: 3 } };

export const Missing: Story = { args: { state: "missing" } };

export const Loading: Story = { args: { state: "loading" } };

export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <OwnershipIcon state="owned" />
        owned
      </div>
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <OwnershipIcon state="owned" count={3} />
        owned (3)
      </div>
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <OwnershipIcon state="missing" />
        missing
      </div>
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <OwnershipIcon state="loading" />
        loading
      </div>
    </div>
  ),
};
