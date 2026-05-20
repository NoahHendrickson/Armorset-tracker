import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ShareFilterLinkButton } from "./share-filter-link-button";
import {
  MOCK_GRID_FILTERS_EMPTY,
  MOCK_GRID_FILTERS_POPULATED,
} from "../../../.storybook/mocks/grid-filters";

const meta: Meta<typeof ShareFilterLinkButton> = {
  title: "Workspace/ShareFilterLinkButton",
  component: ShareFilterLinkButton,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ShareFilterLinkButton>;

export const Enabled: Story = {
  args: {
    filters: MOCK_GRID_FILTERS_POPULATED,
  },
  beforeEach() {
    Object.assign(navigator, {
      clipboard: { writeText: fn().mockResolvedValue(undefined) },
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /copy link to filters/i }),
    );
    await expect(navigator.clipboard.writeText).toHaveBeenCalled();
  },
};

export const DisabledNoSelection: Story = {
  args: {
    filters: MOCK_GRID_FILTERS_EMPTY,
    disabled: true,
  },
};
