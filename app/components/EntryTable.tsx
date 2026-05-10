"use client";

// The main interactive table.
//
// Visual: per the Lightbook Lite design (paper headers, italic serif accents
// in cells, accent-colored drag-over indicator on header columns).
//
// Behavior unchanged: TanStack Table for data + sort, dnd-kit for header
// drag-reorder, useColumnOrder for per-room/per-user persistence. Cell
// content delegates to <CellRenderer>.

import { useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import CellRenderer from "./CellRenderer";
import { useColumnOrder } from "@/lib/hooks/useColumnOrder";
import { BUILTIN_KEYS, METADATA_KEYS } from "@/lib/types";
import type { Category, Entry } from "@/lib/types";

type Props = {
  roomId: string;
  categories: Category[];
  entries: Entry[];
  onAddColumn: () => void;
};

export default function EntryTable({
  roomId,
  categories,
  entries,
  onAddColumn,
}: Props) {
  const categoryKeys = useMemo(
    () => categories.map((c) => c.key),
    [categories],
  );
  const { columnOrder, setColumnOrder } = useColumnOrder(roomId, categoryKeys);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Entry>[]>(
    () =>
      categories.map((cat) => ({
        id: cat.key,
        header: cat.label,
        accessorFn: (row) => sortKey(row, cat.key),
        cell: ({ row }) => (
          <CellRenderer entry={row.original} categoryKey={cat.key} />
        ),
        enableSorting: true,
      })),
    [categories],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, columnOrder },
    onSortingChange: setSorting,
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = columnOrder.indexOf(String(active.id));
    const newIndex = columnOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
  }

  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="entries">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <SortableContext
                  key={headerGroup.id}
                  items={columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  <tr>
                    {headerGroup.headers.map((header) => (
                      <DraggableHeader key={header.id} header={header} />
                    ))}
                    <th
                      style={{ width: 40, textAlign: "right" }}
                    >
                      <button
                        type="button"
                        className="add-col tip"
                        data-tip="Add a column"
                        onClick={onAddColumn}
                      >
                        +
                      </button>
                    </th>
                  </tr>
                </SortableContext>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}

function DraggableHeader({ header }: { header: Header<Entry, unknown> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: header.column.id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
  };

  const sort = header.column.getIsSorted();

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={[
        isDragging ? "is-dragging" : "",
        isOver && !isDragging ? "is-over" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="th-inner"
        onClick={(e) => {
          e.stopPropagation();
          header.column.toggleSorting();
        }}
        title="Click to sort · drag to reorder"
        {...attributes}
        {...listeners}
      >
        <span>
          {flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        <span className={"sort-arrow " + (sort ? "sort-arrow--active" : "")}>
          {sort === "asc" ? "↑" : sort === "desc" ? "↓" : "↕"}
        </span>
      </button>
    </th>
  );
}

function sortKey(entry: Entry, key: string): string | number {
  if (METADATA_KEYS.has(key)) {
    if (key === BUILTIN_KEYS.SUBMITTED_AT) return entry.submittedAt;
    if (key === BUILTIN_KEYS.SUBMITTED_BY)
      return entry.submittedBy.toLowerCase();
    if (key === BUILTIN_KEYS.RAW_DRIVEL) return entry.drivel.toLowerCase();
  }
  const cell = entry.extracted?.[key];
  if (!cell || cell.status !== "ok") return "";
  if (cell.value == null) return "";
  if (Array.isArray(cell.value)) return cell.value.join(", ").toLowerCase();
  return cell.value.toLowerCase();
}
