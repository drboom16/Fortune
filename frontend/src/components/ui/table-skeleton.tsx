import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Skeleton } from "./skeleton";

type Column = { header?: string; className?: string };

interface TableSkeletonProps {
  columns: Column[];
  rowCount?: number;
}

export function TableSkeleton({ columns, rowCount = 5 }: TableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 h-16">
          {columns.map((col, i) => (
            <TableHead key={i} className={col.className}>
              {col.header ?? ""}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {columns.map((col, colIndex) => (
              <TableCell key={colIndex} className={col.className}>
                <Skeleton className="h-5 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
