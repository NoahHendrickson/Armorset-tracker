import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {
  render: () => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="armor-set">Armor set</Label>
      <Input id="armor-set" placeholder="Iron Will Suit" />
    </div>
  ),
};
