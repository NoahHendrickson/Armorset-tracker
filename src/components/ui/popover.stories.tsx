import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { Label } from "./label";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta: Meta = {
  title: "UI/Popover",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold leading-none">Quick filter</h3>
            <p className="text-xs text-muted-foreground">
              Narrow the inventory by tertiary stat.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="popover-search">Search</Label>
            <Input id="popover-search" placeholder="e.g. Class" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
