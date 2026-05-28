// src/components/table-pagination.tsx
"use client";

import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

interface TablePaginationProps<TData> {
  table: Table<TData>;
  showPageCount?: boolean;
}

export function TablePagination<TData>({
  table,
  showPageCount = false,
}: TablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2">
      {showPageCount ? (
        <div className="text-xs text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de{" "}
          {table.getPageCount()}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground font-sans">
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} linha(s) selecionada(s).
        </div>
      )}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="font-sans border-border text-xs h-8"
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="font-sans border-border text-xs h-8"
        >
          Próximo
        </Button>
      </div>
    </div>
  );
}
