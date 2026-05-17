import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrackerGridContent } from "./tracker-grid-content";
import {
  MOCK_PAYLOAD_HUNTER_EMPTY,
  MOCK_PAYLOAD_TITAN_COMPLETE,
  MOCK_PAYLOAD_TITAN_PARTIAL,
} from "../../../.storybook/mocks/tracker-payload";

const meta: Meta<typeof TrackerGridContent> = {
  title: "Workspace/TrackerGridContent",
  component: TrackerGridContent,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof TrackerGridContent>;

export const PartialProgress: Story = {
  render: () => (
    <div style={{ width: 566, height: 384 }}>
      <TrackerGridContent
        payload={MOCK_PAYLOAD_TITAN_PARTIAL}
        hasInventory
        onCompareClick={() => {}}
      />
    </div>
  ),
};

export const CompleteCoverage: Story = {
  render: () => (
    <div style={{ width: 566, height: 384 }}>
      <TrackerGridContent
        payload={MOCK_PAYLOAD_TITAN_COMPLETE}
        hasInventory
        onCompareClick={() => {}}
      />
    </div>
  ),
};

export const NoInventory: Story = {
  render: () => (
    <div style={{ width: 566, height: 384 }}>
      <TrackerGridContent
        payload={MOCK_PAYLOAD_HUNTER_EMPTY}
        hasInventory={false}
        onCompareClick={() => {}}
      />
    </div>
  ),
};
