import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta: Meta = {
  title: "UI/Dialog",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

/** Confirm-delete dialog — matches `view-actions` delete flow. */
export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Delete tracker</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this tracker?</DialogTitle>
          <DialogDescription>
            This only deletes the saved view from your dashboard. Your Bungie
            inventory is untouched.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/** Workspace dialog skin — same surface tokens as duplicate-tracker dialog (extra padding + shadow). */
export const WorkspacePanel: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open workspace dialog</Button>
      </DialogTrigger>
      <DialogContent className="p-8 shadow-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold">
            Duplicate tracker
          </DialogTitle>
          <DialogDescription>
            Adjust anything that should differ from your current tracker&apos;s
            build, then create the new tracker on your canvas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Create tracker</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const OpensOnClick: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connected dialog</DialogTitle>
          <DialogDescription>
            The dialog is now open. Press Escape or click the close button to dismiss.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: /open dialog/i });
    await userEvent.click(trigger);
    await waitFor(async () => {
      const dialog = await within(document.body).findByRole("dialog");
      await expect(dialog).toBeVisible();
    });
    await expect(
      await within(document.body).findByText("Connected dialog"),
    ).toBeVisible();
  },
};
