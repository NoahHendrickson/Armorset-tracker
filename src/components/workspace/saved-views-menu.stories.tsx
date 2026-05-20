import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { SavedFilterViewRow } from "@/lib/db/types";
import { SavedViewsMenu } from "./saved-views-menu";
import { defaultGridFilters } from "@/lib/workspace/grid-filters-schema";
import {
  MOCK_SAVED_FILTER_VIEW_OWNED,
  MOCK_SAVED_FILTER_VIEW_SHARED,
} from "../../../.storybook/mocks/saved-filter-views";

const meta: Meta<typeof SavedViewsMenu> = {
  title: "Workspace/SavedViewsMenu",
  component: SavedViewsMenu,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof SavedViewsMenu>;

function Render({
  initialViews,
  activeViewId = null,
}: {
  initialViews: SavedFilterViewRow[];
  activeViewId?: string | null;
}) {
  const [views, setViews] = useState(initialViews);
  return (
    <SavedViewsMenu
      views={views}
      activeViewId={activeViewId}
      filters={defaultGridFilters()}
      onViewsChange={setViews}
      onApply={() => {}}
      onClearActive={() => {}}
    />
  );
}

export const Empty: Story = {
  render: () => <Render initialViews={[]} />,
};

export const OwnedAndShared: Story = {
  render: () => (
    <Render
      initialViews={[
        MOCK_SAVED_FILTER_VIEW_OWNED,
        MOCK_SAVED_FILTER_VIEW_SHARED,
      ]}
      activeViewId={MOCK_SAVED_FILTER_VIEW_OWNED.id}
    />
  ),
};
