import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  PROGRESS_COMPLETE,
  PROGRESS_EMPTY,
  PROGRESS_PARTIAL,
} from "../../../.storybook/mocks/view-progress";

import { ViewGrid } from "./view-grid";

const meta: Meta<typeof ViewGrid> = {
  title: "Views/ViewGrid",
  component: ViewGrid,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof ViewGrid>;

export const Loading: Story = {
  args: { progress: PROGRESS_EMPTY, hasInventory: false },
};

export const Empty: Story = {
  args: { progress: PROGRESS_EMPTY, hasInventory: true },
};

export const Partial: Story = {
  args: { progress: PROGRESS_PARTIAL, hasInventory: true },
};

export const Complete: Story = {
  args: { progress: PROGRESS_COMPLETE, hasInventory: true },
};
