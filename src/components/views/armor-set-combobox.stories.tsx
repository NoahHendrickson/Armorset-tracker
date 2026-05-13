import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { MOCK_SET_OPTIONS } from "../../../.storybook/mocks/tracker-options";

import { ArmorSetCombobox } from "./armor-set-combobox";

const meta: Meta<typeof ArmorSetCombobox> = {
  title: "Views/ArmorSetCombobox",
  component: ArmorSetCombobox,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ArmorSetCombobox>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={MOCK_SET_OPTIONS}
          value={value}
          onValueChange={setValue}
          sharpCorners
          aria-label="Armor set"
        />
      </div>
    );
  },
};

export const Preselected: Story = {
  render: function Render() {
    const [value, setValue] = useState(String(MOCK_SET_OPTIONS[1]!.hash));
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={MOCK_SET_OPTIONS}
          value={value}
          onValueChange={setValue}
          sharpCorners
          aria-label="Armor set"
        />
      </div>
    );
  },
};

export const FiltersByText: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={MOCK_SET_OPTIONS}
          value={value}
          onValueChange={setValue}
          sharpCorners
          aria-label="Armor set"
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("combobox", { name: /armor set/i });
    await userEvent.click(trigger);
    const search = await within(document.body).findByRole("textbox", {
      name: /search armor sets/i,
    });
    await userEvent.type(search, "Tundra");
    await waitFor(async () => {
      const listbox = await within(document.body).findByRole("listbox");
      const options = await within(listbox).findAllByRole("option");
      await expect(options).toHaveLength(1);
      await expect(options[0]).toHaveTextContent("Tundra Pact");
    });
  },
};

/**
 * The trailing X button only appears once the user has typed something. Clicking
 * it wipes the query, restores the full list, and leaves focus on the input so
 * the user can keep searching without tabbing back.
 */
export const ClearsSearch: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={MOCK_SET_OPTIONS}
          value={value}
          onValueChange={setValue}
          sharpCorners
          aria-label="Armor set"
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("combobox", { name: /armor set/i });
    await userEvent.click(trigger);
    const body = within(document.body);
    const search = await body.findByRole("textbox", {
      name: /search armor sets/i,
    });
    // Empty query: no clear button rendered.
    await expect(body.queryByRole("button", { name: /clear search/i })).toBeNull();

    await userEvent.type(search, "Tundra");
    const clear = await body.findByRole("button", { name: /clear search/i });
    await waitFor(async () => {
      const listbox = await body.findByRole("listbox");
      const options = await within(listbox).findAllByRole("option");
      await expect(options).toHaveLength(1);
    });

    await userEvent.click(clear);
    await waitFor(async () => {
      await expect(search).toHaveValue("");
      const listbox = await body.findByRole("listbox");
      const options = await within(listbox).findAllByRole("option");
      await expect(options.length).toBeGreaterThan(1);
    });
    // Clear button disappears once the query is empty again.
    await expect(body.queryByRole("button", { name: /clear search/i })).toBeNull();
    // Focus returns to the search input so typing resumes immediately.
    await expect(search).toHaveFocus();
  },
};

export const EmptyCatalog: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={[]}
          value={value}
          onValueChange={setValue}
          sharpCorners
          aria-label="Armor set"
          emptyCatalogMessage="No sets available — sync the manifest first."
        />
      </div>
    );
  },
};

export const Invalid: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={MOCK_SET_OPTIONS}
          value={value}
          onValueChange={setValue}
          invalid
          sharpCorners
          aria-label="Armor set"
        />
      </div>
    );
  },
};

/**
 * Demonstrates the "Pinned sets" section. The two preset pins float to the top
 * inside their own section; the divider separates them from the rest of the
 * alphabetical list. Each row exposes a trailing pin/unpin button (hidden on
 * unpinned rows until the row is hovered).
 */
export const WithPins: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    const [pinned, setPinned] = useState<readonly string[]>([
      String(MOCK_SET_OPTIONS[1]!.hash),
      String(MOCK_SET_OPTIONS[3]!.hash),
    ]);
    return (
      <div className="w-80">
        <ArmorSetCombobox
          options={MOCK_SET_OPTIONS}
          value={value}
          onValueChange={setValue}
          sharpCorners
          aria-label="Armor set"
          pinnedHashes={pinned}
          onTogglePin={(hash) =>
            setPinned((prev) =>
              prev.includes(hash)
                ? prev.filter((h) => h !== hash)
                : [...prev, hash],
            )
          }
        />
      </div>
    );
  },
};
