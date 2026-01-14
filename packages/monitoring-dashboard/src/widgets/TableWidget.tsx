'use client';

import React, { useState, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  PaginationState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { BaseWidget, TableConfig } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TableWidgetProps {
  widget: BaseWidget & { config: TableConfig };
  data: Record<string, any>[];
  height?: number;
  loading?: boolean;
  error?: string;
}

export const TableWidget: React.FC<TableWidgetProps> = ({
  widget,
  data,
  height = 400,
  loading = false,
  error,
}) => {
  const { config, title, description } = widget;

  const [sorting, setSorting] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: config.pagination?.pageSize || 10,
  });

  const columns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    return config.columns.map((col): ColumnDef<Record<string, any>> => ({
      id: col.key,
      header: col.label,
      accessorKey: col.key,
      cell: (info) => {
        const value = info.getValue() as any;
        return formatCellValue(value, col);
      },
      enableSorting: col.sortable ?? true,
      enableColumnFilter: col.filterable ?? true,
    }));
  }, [config.columns]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    pageCount: config.pagination?.enabled
      ? Math.ceil(data.length / pagination.pageSize)
      : -1,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive" style={{ height }}>
        <div className="text-center">
          <p className="font-semibold">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      {config.filterable !== false && (
        <div className="mb-4">
          <Input
            placeholder="Filter..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
                      header.column.getCanSort() && 'cursor-pointer hover:text-foreground'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{
                      textAlign: config.columns.find(c => c.key === header.id)?.align || 'left',
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <>
                            {header.column.getIsSorted() === 'asc' && <ArrowUp className="h-4 w-4" />}
                            {header.column.getIsSorted() === 'desc' && <ArrowDown className="h-4 w-4" />}
                            {header.column.getIsSorted() === false && <ArrowUpDown className="h-4 w-4 opacity-30" />}
                          </>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-4 align-middle"
                      style={{
                        textAlign: config.columns.find(c => c.key === cell.column.id)?.align || 'left',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {config.pagination?.enabled && (
        <div className="flex items-center justify-between px-2 mt-4">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${pagination.pageSize}`}
                onValueChange={(value) => {
                  setPagination((old) => ({ ...old, pageSize: Number(value) }));
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {(config.pagination?.pageSizeOptions || [10, 20, 30, 40, 50]).map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPagination((old) => ({ ...old, pageIndex: 0 }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">First page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPagination((old) => ({ ...old, pageIndex: old.pageIndex - 1 }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                Page {pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPagination((old) => ({ ...old, pageIndex: old.pageIndex + 1 }))}
                disabled={pagination.pageIndex >= table.getPageCount() - 1}
              >
                <span className="sr-only">Next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPagination((old) => ({ ...old, pageIndex: table.getPageCount() - 1 }))}
                disabled={pagination.pageIndex >= table.getPageCount() - 1}
              >
                <span className="sr-only">Last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatCellValue(value: any, column: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (column.format) {
    try {
      // Simple formatter based on format string
      switch (column.format) {
        case 'number':
          return Number(value).toLocaleString();
        case 'percentage':
          return `${Number(value).toFixed(1)}%`;
        case 'currency':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(value));
        case 'datetime':
          return new Date(value).toLocaleString();
        case 'date':
          return new Date(value).toLocaleDateString();
        case 'time':
          return new Date(value).toLocaleTimeString();
        default:
          return value;
      }
    } catch (e) {
      return value;
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return String(value);
}

export default TableWidget;
