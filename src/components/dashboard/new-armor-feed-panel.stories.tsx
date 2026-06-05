import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MOCK_DROP_FEED } from "../../../.storybook/mocks/drop-feed";
import { MOCK_WORKSPACE_HEALTH_LOADED } from "../../../.storybook/mocks/workspace-health";
import { InventoryDropFeedProvider } from "./inventory-drop-feed-context";
import { NewArmorFeedPanel } from "./new-armor-feed-panel";
import { WorkspaceSyncProvider } from "./workspace-sync-status";

const meta: Meta<typeof NewArmorFeedPanel> = {
  title: "Dashboard/NewArmorFeedPanel",
  component: NewArmorFeedPanel,
  parameters: { layout: "centered" },
  decorators: [
    (Story, ctx) => (
      <WorkspaceSyncProvider
        health={
          (ctx.parameters.workspaceHealth as typeof MOCK_WORKSPACE_HEALTH_LOADED) ??
          MOCK_WORKSPACE_HEALTH_LOADED
        }
      >
        <InventoryDropFeedProvider
          initialFeed={
            (ctx.parameters.initialFeed as typeof MOCK_DROP_FEED) ?? MOCK_DROP_FEED
          }
        >
          <div className="h-[420px] border border-border bg-background">
            <Story />
          </div>
        </InventoryDropFeedProvider>
      </WorkspaceSyncProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof NewArmorFeedPanel>;

export const WithDrops: Story = {
  args: {
    inventorySyncedAt: MOCK_WORKSPACE_HEALTH_LOADED.inventorySyncedAt,
  },
  parameters: { initialFeed: MOCK_DROP_FEED },
};

export const Empty: Story = {
  args: {
    inventorySyncedAt: MOCK_WORKSPACE_HEALTH_LOADED.inventorySyncedAt,
  },
  parameters: { initialFeed: [] },
};

export const NotSyncedYet: Story = {
  args: {
    inventorySyncedAt: null,
  },
  parameters: { initialFeed: [] },
};
