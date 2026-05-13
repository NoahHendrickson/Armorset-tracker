import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta: Meta = {
  title: "UI/DropdownMenu",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuLabel>Tracker</DropdownMenuLabel>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const OpensAndSelects: Story = {
  render: function Render() {
    const [tertiaries, setTertiaries] = useState<string[]>([]);
    const stats = ["Class", "Melee", "Super", "Grenade"] as const;
    return (
      <div className="flex flex-col items-start gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Tertiary stats ({tertiaries.length})</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {stats.map((stat) => (
              <DropdownMenuCheckboxItem
                key={stat}
                checked={tertiaries.includes(stat)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(c) =>
                  setTertiaries((prev) =>
                    c ? [...prev, stat] : prev.filter((t) => t !== stat),
                  )
                }
              >
                {stat}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <p data-testid="selected-summary" className="text-xs text-muted-foreground">
          {tertiaries.length === 0 ? "Nothing selected" : tertiaries.join(", ")}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: /tertiary stats/i });
    await userEvent.click(trigger);
    const menu = await within(document.body).findByRole("menu");
    const meleeItem = await within(menu).findByRole("menuitemcheckbox", {
      name: "Melee",
    });
    await userEvent.click(meleeItem);
    await waitFor(async () => {
      await expect(canvas.getByTestId("selected-summary")).toHaveTextContent(
        "Melee",
      );
    });
  },
};

/**
 * Inventory-table-style menu — matches the filter dropdowns in the dashboard
 * table view. Uses default token-driven popover surface; every item shows an
 * empty square on the left so users can tell at a glance that the menu is
 * multi-select.
 */
export const InventoryFilterStyle: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Archetype</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44 py-2 shadow-xl">
        <DropdownMenuCheckboxItem
          checked
          onSelect={(e) => e.preventDefault()}
        >
          Bulwark
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()}>
          Brawler
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()}>
          Specialist
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
