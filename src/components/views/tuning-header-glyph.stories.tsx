import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TuningHeaderGlyph } from "./tuning-header-glyph";

const meta: Meta<typeof TuningHeaderGlyph> = {
  title: "Views/TuningHeaderGlyph",
  component: TuningHeaderGlyph,
  parameters: { layout: "centered" },
  argTypes: {
    iconPath: { control: "text" },
    tuningName: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof TuningHeaderGlyph>;

export const NoIcon: Story = {
  args: {
    tuningName: "Tuned: +Weapons / -Grenade",
    iconPath: null,
  },
};
