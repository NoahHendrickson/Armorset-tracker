import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta: Meta = {
  title: "UI/Select",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <SelectTrigger aria-label="Class">
          <SelectValue placeholder="Select a class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Titan</SelectItem>
          <SelectItem value="1">Hunter</SelectItem>
          <SelectItem value="2">Warlock</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const SelectsAValue: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-64 space-y-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger aria-label="Tuning">
            <SelectValue placeholder="Select a tuning" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weapons">+Weapons / -Grenade</SelectItem>
            <SelectItem value="health">+Health / -Super</SelectItem>
            <SelectItem value="class">+Class / -Melee</SelectItem>
          </SelectContent>
        </Select>
        <p data-testid="selected" className="text-xs text-muted-foreground">
          {value || "nothing selected"}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("combobox", { name: /tuning/i });
    await userEvent.click(trigger);
    const option = await within(document.body).findByRole("option", {
      name: "+Health / -Super",
    });
    await userEvent.click(option);
    await waitFor(async () => {
      await expect(canvas.getByTestId("selected")).toHaveTextContent("health");
    });
  },
};

/** Opt back into rounded corners by passing `rounded-md` to trigger and content. */
export const RoundedOverride: Story = {
  render: () => (
    <div className="w-64">
      <Select>
        <SelectTrigger aria-label="Class" className="rounded-md">
          <SelectValue placeholder="Select a class" />
        </SelectTrigger>
        <SelectContent className="rounded-md">
          <SelectItem value="0">Titan</SelectItem>
          <SelectItem value="1">Hunter</SelectItem>
          <SelectItem value="2">Warlock</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
