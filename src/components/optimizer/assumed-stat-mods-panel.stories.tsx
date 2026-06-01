import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  DEFAULT_ASSUMED_STAT_MODS,
  totalAssumedModBudget,
  type AssumedStatMods,
} from "@/lib/optimizer/mod-offset";
import { AssumedStatModsPanel } from "./assumed-stat-mods-panel";

const meta: Meta<typeof AssumedStatModsPanel> = {
  title: "Optimizer/AssumedStatModsPanel",
  component: AssumedStatModsPanel,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof AssumedStatModsPanel>;

function Render({ initial = DEFAULT_ASSUMED_STAT_MODS }: { initial?: AssumedStatMods }) {
  const [value, setValue] = useState(initial);
  const budget = totalAssumedModBudget(value);
  return (
    <div className="max-w-sm border border-border bg-card p-4">
      <AssumedStatModsPanel value={value} onChange={setValue} />
      <p
        data-testid="mod-budget"
        className="mt-3 text-xs tabular-nums text-muted-foreground"
      >
        majorCount={value.majorCount}, minorCount={budget.minorCount}, total=
        {budget.total}
      </p>
    </div>
  );
}

export const Default: Story = {
  render: () => <Render />,
};

export const AllMinorMods: Story = {
  render: () => <Render initial={{ majorCount: 0 }} />,
};

export const SelectMajorCount: Story = {
  render: () => <Render />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "3" }));
    await expect(canvas.getByTestId("mod-budget")).toHaveTextContent(
      "majorCount=3, minorCount=2, total=40",
    );
    await expect(canvas.getByText(/3 major \(\+30\)/)).toBeInTheDocument();
    await expect(canvas.getByText(/2 minor \(\+10\)/)).toBeInTheDocument();
  },
};

export const FiveMajorsNoMinors: Story = {
  render: () => <Render initial={{ majorCount: 5 }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("mod-budget")).toHaveTextContent(
      "minorCount=0, total=50",
    );
    await expect(canvas.getByText(/5 major \(\+50\)/)).toBeInTheDocument();
  },
};
