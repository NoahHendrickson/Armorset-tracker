import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { placeholder: "Tracker name" },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="tracker-name">Tracker name</Label>
      <Input id="tracker-name" {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: "Disabled value" },
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
};

/** Opt back into rounded corners by passing a `rounded-*` class. */
export const RoundedOverride: Story = {
  args: { className: "rounded-md" },
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
};
