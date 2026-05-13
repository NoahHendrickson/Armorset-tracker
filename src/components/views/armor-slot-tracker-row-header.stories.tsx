import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SLOT_ORDER } from "@/lib/bungie/constants";

import { ArmorSlotTrackerRowHeader } from "./armor-slot-tracker-row-header";

const meta: Meta<typeof ArmorSlotTrackerRowHeader> = {
  title: "Views/ArmorSlotTrackerRowHeader",
  component: ArmorSlotTrackerRowHeader,
  parameters: { layout: "centered" },
  argTypes: {
    slot: {
      control: { type: "inline-radio" },
      options: SLOT_ORDER,
    },
    tooltipSide: {
      control: { type: "inline-radio" },
      options: ["left", "right"],
    },
    iconPath: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof ArmorSlotTrackerRowHeader>;

export const HelmetTextFallback: Story = {
  args: { slot: "helmet", iconPath: undefined, isLastRow: true },
};

export const AllSlots: Story = {
  render: () => (
    <div className="flex w-14 flex-col rounded-md border border-border bg-card">
      {SLOT_ORDER.map((slot, i) => (
        <ArmorSlotTrackerRowHeader
          key={slot}
          slot={slot}
          iconPath={undefined}
          isLastRow={i >= SLOT_ORDER.length - 1}
        />
      ))}
    </div>
  ),
};
