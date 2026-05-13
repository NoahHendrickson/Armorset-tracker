import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import {
  MOCK_ARCHETYPE_OPTIONS,
  MOCK_SET_OPTIONS,
  MOCK_TUNING_OPTIONS,
} from "../../../.storybook/mocks/tracker-options";

import { NewViewForm } from "./new-view-form";

const meta: Meta<typeof NewViewForm> = {
  title: "Views/NewViewForm",
  component: NewViewForm,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
  },
  args: {
    setsByClass: {
      0: MOCK_SET_OPTIONS,
      1: MOCK_SET_OPTIONS,
      2: MOCK_SET_OPTIONS,
    },
    archetypes: MOCK_ARCHETYPE_OPTIONS,
    tunings: MOCK_TUNING_OPTIONS,
  },
};
export default meta;

type Story = StoryObj<typeof NewViewForm>;

export const Empty: Story = {
  render: (args) => (
    <div className="mx-auto w-[28rem]">
      <NewViewForm {...args} />
    </div>
  ),
};

export const Embedded: Story = {
  args: { embedded: true },
  render: (args) => (
    <div className="mx-auto w-[28rem]">
      <NewViewForm {...args} />
    </div>
  ),
};

export const Prefilled: Story = {
  args: {
    embedded: true,
    requireChangeFromPrefill: true,
    prefillFrom: {
      classType: 0,
      setHash: MOCK_SET_OPTIONS[0]!.hash,
      archetypeHash: MOCK_ARCHETYPE_OPTIONS[0]!.hash,
      tuningHash: MOCK_TUNING_OPTIONS[0]!.hash,
    },
  },
  render: (args) => (
    <div className="mx-auto w-[28rem]">
      <NewViewForm {...args} />
    </div>
  ),
};

/** Submit is disabled until every required field is selected (canSubmit gating). */
export const SubmitDisabledByDefault: Story = {
  render: (args) => (
    <div className="mx-auto w-[28rem]">
      <NewViewForm {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = await canvas.findByRole("button", { name: /create view/i });
    await expect(submit).toBeDisabled();
  },
};
