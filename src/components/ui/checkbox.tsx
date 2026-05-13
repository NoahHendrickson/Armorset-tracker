"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

/**
 * Visual styling for the small square indicator. Shared between the standalone
 * `<Checkbox>` and `<DropdownMenuCheckboxItem>` so both render the same shape,
 * size, and border. The border uses `border-current/40` so the box adopts the
 * surrounding text color — that's what lets the dropdown menu version blend
 * into the menu while the standalone version inherits the page foreground.
 */
export const checkboxBoxClassName =
  "flex h-4 w-4 shrink-0 items-center justify-center border border-current/40 transition-colors";

/** Inner check icon size used inside `checkboxBoxClassName`. */
export const checkboxIconClassName = "h-3 w-3";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      checkboxBoxClassName,
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check weight="bold" className={checkboxIconClassName} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
