"use client";

import type { RouterOutputs } from "@tamias/trpc";
import { Table, TableBody } from "@tamias/ui/table";
import { TableRow } from "./table-row";

type Props = {
  data: RouterOutputs["team"]["list"];
};

export function SelectTeamTable({ data }: Props) {
  return (
    <Table>
      <TableBody className="border-none">
        {data.map((row) => (
          <TableRow key={row.id} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}
