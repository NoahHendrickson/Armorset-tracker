import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Recent armor pieces in vault</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Slot</TableHead>
          <TableHead>Set</TableHead>
          <TableHead>Tuning</TableHead>
          <TableHead className="text-right">Tertiary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Helmet</TableCell>
          <TableCell>Iron Will</TableCell>
          <TableCell>+Weapons / -Grenade</TableCell>
          <TableCell className="text-right">Class</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Arms</TableCell>
          <TableCell>Iron Will</TableCell>
          <TableCell>+Weapons / -Grenade</TableCell>
          <TableCell className="text-right">Melee</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Chest</TableCell>
          <TableCell>Reverie Dawn</TableCell>
          <TableCell>+Health / -Super</TableCell>
          <TableCell className="text-right">Class</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
