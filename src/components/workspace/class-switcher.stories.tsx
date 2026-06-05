import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { GridFilterClass } from "@/lib/workspace/grid-filters-schema";
import { ClassSwitcher } from "./class-switcher";
import { EmbeddedClassSearchField } from "./embedded-class-search-field";

const meta: Meta<typeof ClassSwitcher> = {
  title: "Workspace/ClassSwitcher",
  component: ClassSwitcher,
  parameters: { layout: "padded" },
  argTypes: {
    variant: {
      control: "radio",
      options: ["default", "condensed"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof ClassSwitcher>;

function ControlledSwitcher({
  variant = "default",
  initialClass = 0 as GridFilterClass,
  className,
}: {
  variant?: "default" | "condensed";
  initialClass?: GridFilterClass;
  className?: string;
}) {
  const [value, setValue] = useState<GridFilterClass>(initialClass);
  return (
    <ClassSwitcher
      variant={variant}
      value={value}
      onChange={setValue}
      className={className}
    />
  );
}

/** Grid / optimizer filter bar — standalone tabs on card chrome. */
export const Default: Story = {
  args: { variant: "default" },
  render: (args) => (
    <div className="inline-flex border border-border bg-card p-4">
      <ControlledSwitcher variant={args.variant} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hunter = await canvas.findByRole("button", { name: "Hunter" });
    await userEvent.click(hunter);
    await expect(hunter).toHaveAttribute("aria-pressed", "true");
  },
};

/** Table filter row — same surface as {@link TrackerFilterBar} in inventory table. */
export const OnTableHeader: Story = {
  render: () => (
    <div className="inline-flex min-h-[60px] items-center border border-border bg-table-header px-3 py-2">
      <ControlledSwitcher variant="default" />
    </div>
  ),
};

/** Loadout optimizer “Class” section — card background, no outer bar. */
export const OnOptimizerCard: Story = {
  render: () => (
    <div className="max-w-md border border-border bg-card p-5">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Class</p>
      <ControlledSwitcher variant="default" />
    </div>
  ),
};

/** Table search compound — same component as production {@link TrackerFilterBar}. */
export const CondensedInSearch: Story = {
  render: () => <CondensedSearchCompound initialClass={1} initialQuery="" />,
};

export const CondensedInSearchIdle: Story = {
  render: () => <CondensedSearchCompound initialClass={0} initialQuery="" />,
};

export const CondensedInSearchWithQuery: Story = {
  render: () => (
    <CondensedSearchCompound initialClass={2} initialQuery="ferro" />
  ),
};

function CondensedSearchCompound({
  initialClass,
  initialQuery,
}: {
  initialClass: GridFilterClass;
  initialQuery: string;
}) {
  const [classValue, setClassValue] = useState<GridFilterClass>(initialClass);
  const [search, setSearch] = useState(initialQuery);

  return (
    <div className="inline-flex min-h-[60px] items-center border border-border bg-table-header px-3 py-2">
      <EmbeddedClassSearchField
        search={search}
        onSearchChange={setSearch}
        classValue={classValue}
        onClassChange={setClassValue}
      />
    </div>
  );
}

/** Side-by-side: every surface variant for visual parity checks. */
export const AllSurfaces: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="flex flex-col gap-8 bg-background p-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Default · filter bar / optimizer
        </h3>
        <div className="flex flex-wrap items-center gap-6">
          <div className="inline-flex border border-border bg-card p-3">
            <ControlledSwitcher variant="default" initialClass={0} />
          </div>
          <div className="inline-flex min-h-[60px] items-center border border-border bg-table-header px-3 py-2">
            <ControlledSwitcher variant="default" initialClass={1} />
          </div>
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Condensed · table search
        </h3>
        <CondensedSearchCompound initialClass={2} initialQuery="" />
      </section>
    </div>
  ),
};
