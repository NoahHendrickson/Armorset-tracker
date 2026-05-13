import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ArrowRight,
  Copy,
  Info,
  Pencil,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: { type: "inline-radio" },
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
  args: { children: "Button" },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Delete">
        <Trash weight="duotone" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        Continue
        <ArrowRight weight="duotone" />
      </>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

/**
 * Outline-variant icon buttons. The icon-only square button is a common
 * affordance for toolbars and row actions. Always pair it with an `aria-label`
 * (or `aria-labelledby` / a wrapping `Tooltip`) so screen readers announce
 * the action.
 */
export const OutlineIconButtons: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" aria-label="Add item">
        <Plus weight="duotone" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Edit">
        <Pencil weight="duotone" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Copy">
        <Copy weight="duotone" />
      </Button>
      <Button variant="outline" size="icon" aria-label="More info">
        <Info weight="duotone" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Delete">
        <Trash weight="duotone" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Close">
        <X weight="duotone" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Disabled action" disabled>
        <Info weight="duotone" />
      </Button>
    </div>
  ),
};
