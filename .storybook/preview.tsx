import type { Decorator, Preview } from "@storybook/nextjs-vite";
import React from "react";

import { TooltipAppShell } from "../src/components/ui/tooltip";
import "../src/app/globals.css";

const withThemeAndPadding: Decorator = (Story, context) => {
  const theme = (context.globals.theme as "light" | "dark") ?? "dark";
  return (
    <TooltipAppShell>
      <div
        className={`${theme === "dark" ? "dark " : ""}bg-background text-foreground p-6 min-h-[120px]`}
        data-theme={theme}
      >
        <Story />
      </div>
    </TooltipAppShell>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    a11y: {
      // 'todo' = surface violations in the Storybook a11y panel but don't fail
      // `vitest --project=storybook` runs. Flip to 'error' once existing
      // violations (e.g. destructive button color contrast on dark theme) are
      // resolved, to enforce a11y as a hard CI gate.
      test: "todo",
    },
  },
  globalTypes: {
    theme: {
      description: "App theme (controls .dark class on the wrapper)",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [withThemeAndPadding],
};

export default preview;
