import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { OptimizerResultsPlaceholder } from "./optimizer-results-placeholder";

const meta: Meta<typeof OptimizerResultsPlaceholder> = {
  title: "Optimizer/OptimizerResultsPlaceholder",
  component: OptimizerResultsPlaceholder,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-4">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof OptimizerResultsPlaceholder>;

export const Idle: Story = {
  args: {
    phase: "idle",
    hint: "Set a stat minimum or an armor set to start.",
  },
};

export const Priming: Story = {
  args: {
    phase: "priming",
    hint: "Add another target to start auto-generating.",
  },
};

export const Generating: Story = {
  args: {
    phase: "generating",
    progress: 42,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Generating builds/i)).toBeInTheDocument();
    await expect(canvas.getByText(/42%/)).toBeInTheDocument();
  },
};
