import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["default", "secondary", "destructive", "success", "outline"],
    },
  },
  args: { children: "Badge" },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

/**
 * Tracker header pill — neon-green accent. Matches `tracker-ident-badges.tsx`
 * and `tuning-header-glyph.tsx` on canvas trackers.
 */
export const TrackerPill: Story = {
  render: () => (
    <Badge
      variant="outline"
      className="border-[#00FF85] bg-[#00FF85]/14 px-3 py-1.5 text-sm font-medium text-foreground shadow-none"
    >
      Iron Will Suit
    </Badge>
  ),
};
