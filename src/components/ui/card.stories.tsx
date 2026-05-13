import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Tracker created</CardTitle>
        <CardDescription>
          Iron Will · Bulwark · Tuned: +Weapons / -Grenade
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          You&apos;re tracking 2 / 20 cells across 5 armor slots.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">
          Dismiss
        </Button>
        <Button size="sm">Open tracker</Button>
      </CardFooter>
    </Card>
  ),
};
