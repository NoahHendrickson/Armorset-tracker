import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  MOCK_PAYLOAD_HUNTER_EMPTY,
  MOCK_PAYLOAD_TITAN_COMPLETE,
  MOCK_PAYLOAD_TITAN_PARTIAL,
} from "../../../.storybook/mocks/tracker-payload";

import { MergedCompareGrid } from "./merged-compare-grid";

const meta: Meta<typeof MergedCompareGrid> = {
  title: "Views/MergedCompareGrid",
  component: MergedCompareGrid,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof MergedCompareGrid>;

export const PartialAnchorEmptyPartner: Story = {
  args: {
    anchorPayload: MOCK_PAYLOAD_TITAN_PARTIAL,
    partnerPayload: MOCK_PAYLOAD_HUNTER_EMPTY,
    hasInventory: true,
  },
};

export const Complete: Story = {
  args: {
    anchorPayload: MOCK_PAYLOAD_TITAN_COMPLETE,
    partnerPayload: MOCK_PAYLOAD_TITAN_COMPLETE,
    hasInventory: true,
  },
};

export const Loading: Story = {
  args: {
    anchorPayload: MOCK_PAYLOAD_TITAN_PARTIAL,
    partnerPayload: MOCK_PAYLOAD_HUNTER_EMPTY,
    hasInventory: false,
  },
};
