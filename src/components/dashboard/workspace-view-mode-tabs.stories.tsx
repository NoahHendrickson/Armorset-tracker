import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  WorkspaceViewModeTabs,
  type WorkspaceViewMode,
} from "./workspace-view-mode-tabs";

const meta: Meta<typeof WorkspaceViewModeTabs> = {
  title: "Dashboard/WorkspaceViewModeTabs",
  component: WorkspaceViewModeTabs,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof WorkspaceViewModeTabs>;

export const CanvasSelected: Story = {
  render: function Render() {
    const [mode, setMode] = useState<WorkspaceViewMode>("canvas");
    return <WorkspaceViewModeTabs mode={mode} onModeChange={setMode} />;
  },
};

export const TableSelected: Story = {
  render: function Render() {
    const [mode, setMode] = useState<WorkspaceViewMode>("table");
    return <WorkspaceViewModeTabs mode={mode} onModeChange={setMode} />;
  },
};
