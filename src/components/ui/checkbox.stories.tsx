import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Checkbox } from "./checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";
import { Label } from "./label";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { "aria-label": "Toggle option" },
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};

/**
 * The four states the checkbox can be in. Disabled checkboxes still announce
 * their checked state to screen readers, but pointer events are dropped.
 */
export const States: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Checkbox aria-label="Unchecked" />
      <Checkbox aria-label="Checked" defaultChecked />
      <Checkbox aria-label="Disabled unchecked" disabled />
      <Checkbox aria-label="Disabled checked" disabled defaultChecked />
    </div>
  ),
};

/**
 * Pair the checkbox with a `<Label htmlFor>` so clicking the label toggles
 * the checkbox and screen readers announce the field name. This is the
 * preferred pattern over `aria-label` when there is visible label text.
 */
export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="show-tertiaries" />
      <Label htmlFor="show-tertiaries">Show tertiary stats</Label>
    </div>
  ),
};

/**
 * Checks that clicking the checkbox toggles its state and the controlled
 * value flows through `onCheckedChange`. Mirrors the wiring used by the
 * inventory-table filter dropdowns.
 */
export const TogglesOnClick: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="opt-in"
            checked={checked}
            onCheckedChange={(c) => setChecked(c === true)}
          />
          <Label htmlFor="opt-in">Opt in</Label>
        </div>
        <p data-testid="state" className="text-xs text-muted-foreground">
          {checked ? "Opted in" : "Not opted in"}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cb = canvas.getByRole("checkbox", { name: /opt in/i });
    await expect(canvas.getByTestId("state")).toHaveTextContent("Not opted in");
    await userEvent.click(cb);
    await waitFor(async () => {
      await expect(canvas.getByTestId("state")).toHaveTextContent("Opted in");
    });
    await userEvent.click(cb);
    await waitFor(async () => {
      await expect(canvas.getByTestId("state")).toHaveTextContent("Not opted in");
    });
  },
};

/**
 * Confirms that `<Checkbox>` renders the same visual square as
 * `<DropdownMenuCheckboxItem>` — both consume the shared
 * `checkboxBoxClassName` from `./checkbox`. The play step opens the menu and
 * checks that the standalone checkbox and the menu indicator share the same
 * 16x16 bounding box, so a future style change to one without the other will
 * break the test.
 */
export const MatchesDropdownIndicator: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-2">
        <Checkbox id="standalone-cb" defaultChecked aria-label="Standalone" />
        <Label htmlFor="standalone-cb">Standalone Checkbox</Label>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Open menu with checkbox item</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuCheckboxItem checked onSelect={(e) => e.preventDefault()}>
            Inside dropdown
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const standalone = canvas.getByRole("checkbox", { name: /standalone/i });
    const trigger = canvas.getByRole("button", {
      name: /open menu with checkbox item/i,
    });
    await userEvent.click(trigger);
    const menu = await within(document.body).findByRole("menu");
    const menuItem = await within(menu).findByRole("menuitemcheckbox", {
      name: /inside dropdown/i,
    });
    const standaloneRect = standalone.getBoundingClientRect();
    // The dropdown's visual square is an `aria-hidden` span absolutely
    // positioned inside the menu item — query it directly so we measure the
    // box, not the entire menu row.
    const menuBox = menuItem.querySelector('span[aria-hidden="true"]');
    await expect(menuBox).not.toBeNull();
    const menuRect = (menuBox as HTMLElement).getBoundingClientRect();
    // Allow ±1px to absorb sub-pixel rendering differences between a
    // `<button>` Root and an absolutely-positioned `<span>` indicator. If
    // the two genuinely diverge in size (e.g. someone changes `h-4 w-4` in
    // one place but not the other), the diff will exceed 1px.
    await expect(Math.abs(standaloneRect.width - menuRect.width)).toBeLessThanOrEqual(1);
    await expect(Math.abs(standaloneRect.height - menuRect.height)).toBeLessThanOrEqual(1);
  },
};
