import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import { OPTIMIZER_STAT_DISPLAY_ORDER } from "@/lib/optimizer/stat-range";
import { StatRangeSlider } from "./stat-range-slider";

const meta: Meta<typeof StatRangeSlider> = {
  title: "Optimizer/StatRangeSlider",
  component: StatRangeSlider,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof StatRangeSlider>;

function SliderShell({
  initialMin = 0,
  achievableMin = 0,
  achievableMax = 200,
  compact = false,
}: {
  initialMin?: number;
  achievableMin?: number;
  achievableMax?: number;
  compact?: boolean;
}) {
  const [min, setMin] = useState(initialMin);
  return (
    <div className="max-w-sm border border-border bg-card p-4">
      <StatRangeSlider
        stat="Weapons"
        min={min}
        achievableMin={achievableMin}
        achievableMax={achievableMax}
        onChange={setMin}
        compact={compact}
      />
      <p
        data-testid="stat-min-value"
        className="mt-3 text-xs tabular-nums text-muted-foreground"
      >
        min={min}
      </p>
    </div>
  );
}

function clickTrackAtRatio(
  canvas: ReturnType<typeof within>,
  ratio: number,
) {
  const hit = canvas.getByTestId("stat-range-track-hit");
  const rect = hit.getBoundingClientRect();
  const clientX = rect.left + rect.width * ratio;
  fireEvent.pointerDown(hit, {
    clientX,
    button: 0,
    pointerId: 1,
  });
}

export const Default: Story = {
  render: () => <SliderShell />,
};

/** Figma selected state: green track, green ticks, value box shows target. */
export const TargetedAt200: Story = {
  render: () => <SliderShell initialMin={200} compact />,
  parameters: { backgrounds: { default: "dark" } },
  globals: { theme: "dark" },
};

/** Figma unselected state: gray track, gray ticks, value box shows 0. */
export const Untargeted: Story = {
  render: () => <SliderShell initialMin={0} compact />,
  parameters: { backgrounds: { default: "dark" } },
  globals: { theme: "dark" },
};

export const PresetAt100: Story = {
  render: () => <SliderShell initialMin={100} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
      "min=100",
    );
  },
};

export const NarrowAchievableBand: Story = {
  render: () => (
    <SliderShell achievableMin={80} achievableMax={80} initialMin={0} />
  ),
};

export const CompactStack: Story = {
  render: () => {
    const [mins, setMins] = useState<Record<string, number>>({});
    return (
      <div className="max-w-sm border border-border bg-card p-4">
        <ul className="space-y-1">
          {OPTIMIZER_STAT_DISPLAY_ORDER.map((stat) => (
            <li key={stat}>
              <StatRangeSlider
                stat={stat}
                min={mins[stat] ?? 0}
                achievableMin={40}
                achievableMax={180}
                onChange={(next) =>
                  setMins((prev) => ({ ...prev, [stat]: next }))
                }
                compact
              />
            </li>
          ))}
        </ul>
      </div>
    );
  },
};

export const TrackClickSnapsNearPreset: Story = {
  render: () => <SliderShell />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    clickTrackAtRatio(canvas, 0.25);
    await expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
      "min=50",
    );
  },
};

export const TrackClickExactBetween: Story = {
  render: () => <SliderShell />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    clickTrackAtRatio(canvas, 0.365);
    const text = canvas.getByTestId("stat-min-value").textContent ?? "";
    const value = Number(text.replace("min=", ""));
    await expect(value).toBeGreaterThan(60);
    await expect(value).toBeLessThan(80);
    await expect(value).not.toBe(50);
    await expect(value).not.toBe(100);
  },
};

export const ToggleOffPreset: Story = {
  render: () => <SliderShell initialMin={100} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    clickTrackAtRatio(canvas, 0.5);
    await expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
      "min=0",
    );
  },
};

export const DragThumb: Story = {
  render: () => <SliderShell />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slider = canvas.getByRole("slider", { name: /weapons minimum/i });
    fireEvent.input(slider, { target: { value: "100" } });
    await expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
      "min=100",
    );
  },
};

export const ClickMaxLabel: Story = {
  render: () => (
    <SliderShell achievableMin={40} achievableMax={175} initialMin={0} compact />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("stat-max-label"));
    await expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
      "min=175",
    );
  },
};

export const TypeMinInInput: Story = {
  render: () => <SliderShell />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId("stat-min-input");
    await userEvent.clear(input);
    await userEvent.type(input, "120");
    await userEvent.tab();
    await waitFor(() =>
      expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
        "min=120",
      ),
    );
  },
};

export const TypeMinAndPressEnter: Story = {
  render: () => <SliderShell />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByTestId("stat-min-input");
    await userEvent.clear(input);
    await userEvent.type(input, "200{Enter}");
    await waitFor(() =>
      expect(canvas.getByTestId("stat-min-value")).toHaveTextContent(
        "min=200",
      ),
    );
  },
};
