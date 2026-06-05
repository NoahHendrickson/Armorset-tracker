import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { MOCK_GRID_LOOKUP_PAYLOAD } from "../../../.storybook/mocks/grid-lookup";
import { MOCK_ARCHETYPES } from "../../../.storybook/mocks/manifest-lookups";
import { MOCK_OPTIMIZER_LOOKUP } from "../../../.storybook/mocks/optimizer-lookup";
import type { TrackerFormSelectors } from "@/lib/views/tracker-form-selectors";
import { ArchetypePlanView } from "./archetype-plan-view";

const MOCK_SELECTORS: TrackerFormSelectors = {
  setsByClass: { 0: [], 1: [], 2: [] },
  archetypes: MOCK_ARCHETYPES.map((a) => ({
    hash: a.archetype_hash,
    name: a.name,
  })),
  tunings: [],
  manifestEmpty: false,
};

const meta: Meta<typeof ArchetypePlanView> = {
  title: "Dashboard/ArchetypePlanView",
  component: ArchetypePlanView,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof ArchetypePlanView>;

export const Default: Story = {
  render: () => (
    <div className="flex h-[80vh] flex-col bg-background">
      <ArchetypePlanView
        lookupPayload={MOCK_GRID_LOOKUP_PAYLOAD}
        selectors={MOCK_SELECTORS}
        optimizerLookup={MOCK_OPTIMIZER_LOOKUP}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: /archetype plan/i }),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/stat goals/i)).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: /^fragments$/i }),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/ember of beams/i)).toBeInTheDocument();
    await expect(
      canvas.getByText(/stat-affecting fragments only/i),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/loadout mix/i)).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: /^loadout maximums$/i }),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/5 \/ 5 pieces assigned/i)).toBeInTheDocument();
  },
};

export const MixedGunnerAndCustom: Story = {
  render: () => (
    <div className="flex h-[80vh] flex-col bg-background">
      <ArchetypePlanView
        lookupPayload={MOCK_GRID_LOOKUP_PAYLOAD}
        selectors={MOCK_SELECTORS}
        optimizerLookup={MOCK_OPTIMIZER_LOOKUP}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const brawlerRow = canvas.getByText("Brawler").closest("li");
    expect(brawlerRow).toBeTruthy();
    const brawlerPieces = within(brawlerRow!).getByRole("group", {
      name: /piece count for brawler/i,
    });
    await userEvent.click(within(brawlerPieces).getByRole("button", { name: "0" }));

    const gunnerRow = canvas.getByText("Gunner").closest("li");
    expect(gunnerRow).toBeTruthy();
    const gunnerPieces = within(gunnerRow!).getByRole("group", {
      name: /piece count for gunner/i,
    });
    await userEvent.click(within(gunnerPieces).getByRole("button", { name: "3" }));

    const customRow = canvas
      .getByText("Weapons / Super (hypothetical)")
      .closest("li");
    expect(customRow).toBeTruthy();
    const customPieces = within(customRow!).getByRole("group", {
      name: /piece count for weapons \/ super/i,
    });
    await userEvent.click(within(customPieces).getByRole("button", { name: "2" }));

    await expect(canvas.getByText(/5 \/ 5 pieces assigned/i)).toBeInTheDocument();
  },
};
