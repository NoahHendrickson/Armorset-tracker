import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Info } from "@phosphor-icons/react/dist/ssr";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta: Meta = {
  title: "UI/Tooltip",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More info">
          <Info weight="duotone" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Hover or focus to see this tooltip.</TooltipContent>
    </Tooltip>
  ),
};

export const AllSides: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-12 p-8">
      {(["top", "bottom", "left", "right"] as const).map((side) => (
        <Tooltip key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">
              {side}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Tooltip on {side}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};
