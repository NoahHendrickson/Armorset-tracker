import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TuningHeaderGlyph } from "@/components/views/tuning-header-glyph";

import { TrackerIdentBadges } from "./tracker-ident-badges";

const meta: Meta<typeof TrackerIdentBadges> = {
  title: "Workspace/TrackerIdentBadges",
  component: TrackerIdentBadges,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof TrackerIdentBadges>;

export const SetAndArchetype: Story = {
  args: {
    setName: "Iron Will Suit",
    archetypeName: "Bulwark",
  },
};

export const WithTuningPill: Story = {
  args: {
    setName: "Reverie Dawn",
    archetypeName: "Brawler",
    tuning: (
      <TuningHeaderGlyph
        tuningName="Tuned: +Health / -Super"
        iconPath={null}
      />
    ),
  },
};

export const TruncatesLongNames: Story = {
  args: {
    setName: "Ridiculously Lengthy Seasonal Armor Set Name That Wraps",
    archetypeName: "Specialist Subclass Variant Two",
  },
};
