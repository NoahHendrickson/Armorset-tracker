import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ViewActions } from "./view-actions";

const meta: Meta<typeof ViewActions> = {
  title: "Views/ViewActions",
  component: ViewActions,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
  argTypes: {
    layout: {
      control: { type: "inline-radio" },
      options: ["inline", "sidebar"],
    },
  },
  args: { viewId: "11111111-1111-1111-1111-111111111111" },
};
export default meta;

type Story = StoryObj<typeof ViewActions>;

export const Inline: Story = { args: { layout: "inline" } };

export const Sidebar: Story = {
  args: { layout: "sidebar" },
  render: (args) => (
    <div className="flex h-32 w-12 items-start justify-center rounded-md bg-accent p-2">
      <ViewActions {...args} />
    </div>
  ),
};
