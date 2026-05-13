import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BungieProfileAvatar } from "./bungie-profile-avatar";

const meta: Meta<typeof BungieProfileAvatar> = {
  title: "Components/BungieProfileAvatar",
  component: BungieProfileAvatar,
  parameters: { layout: "centered" },
  argTypes: {
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "lg"],
    },
    profilePictureUrl: { control: "text" },
    displayName: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof BungieProfileAvatar>;

export const InitialsFallback: Story = {
  args: {
    displayName: "Cayde Six",
    profilePictureUrl: null,
    size: "lg",
  },
};

export const BrokenImageFallsBack: Story = {
  args: {
    displayName: "Ikora Rey",
    // Intentionally invalid URL → component flips to initials on error.
    profilePictureUrl: "https://invalid.example/missing-avatar.png",
    size: "lg",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <BungieProfileAvatar
        displayName="Zavala"
        profilePictureUrl={null}
        size="sm"
      />
      <BungieProfileAvatar
        displayName="Zavala"
        profilePictureUrl={null}
        size="lg"
      />
    </div>
  ),
};
