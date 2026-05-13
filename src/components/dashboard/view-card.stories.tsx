import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  PROGRESS_COMPLETE,
  PROGRESS_EMPTY,
  PROGRESS_PARTIAL,
} from "../../../.storybook/mocks/view-progress";
import { MOCK_VIEW_TITAN } from "../../../.storybook/mocks/view-row";

import { ViewCard } from "./view-card";

const meta: Meta<typeof ViewCard> = {
  title: "Dashboard/ViewCard",
  component: ViewCard,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ViewCard>;

export const Empty: Story = {
  render: () => (
    <div className="w-80">
      <ViewCard
        view={MOCK_VIEW_TITAN}
        progress={PROGRESS_EMPTY}
        setName="Iron Will Suit"
        archetypeName="Bulwark"
        tuningName="Tuned: +Weapons / -Grenade"
      />
    </div>
  ),
};

export const Partial: Story = {
  render: () => (
    <div className="w-80">
      <ViewCard
        view={MOCK_VIEW_TITAN}
        progress={PROGRESS_PARTIAL}
        setName="Iron Will Suit"
        archetypeName="Bulwark"
        tuningName="Tuned: +Weapons / -Grenade"
      />
    </div>
  ),
};

export const Complete: Story = {
  render: () => (
    <div className="w-80">
      <ViewCard
        view={MOCK_VIEW_TITAN}
        progress={PROGRESS_COMPLETE}
        setName="Iron Will Suit"
        archetypeName="Bulwark"
        tuningName="Tuned: +Weapons / -Grenade"
      />
    </div>
  ),
};
