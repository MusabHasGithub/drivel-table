"use client";

// Sortable + drag-reorder + per-row delete table.
// Behavior: TanStack Table for data + sort, dnd-kit for header drag,
// useColumnOrder for per-room/per-user persistence. Cells delegate to
// <CellRenderer>. Per-row hover reveals a trash icon; per-column hover
// (in the header) reveals a trash icon next to the label.

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
import ConfirmModal from "./ConfirmModal";
import { useColumnOrder } from "@/lib/hooks/useColumnOrder";
import { deleteEntry } from "@/lib/entries";
import { deleteCategory } from "@/lib/categories";
import { BUILTIN_KEYS, METADATA_KEYS } from "@/lib/types";
import type { Category, Entry } from "@/lib/types";

type Props = {
  roomId: string;
  identity: string;
  categories: Category[];
  entries: Entry[];
  onAddColumn: () => void;
};

type PendingDelete =
  | { kind: "entry"; entry: Entry }
  | { kind: "category"; category: Category }
  | null;

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function EntryTable({
  roomId,
  identity,
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
  const [pending, setPending] = useState<PendingDelete>(null);

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
    <>
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
                      {headerGroup.headers.map((header) => {
                        const cat = categories.find(
                          (c) => c.key === header.id,
                        );
                        const canDelete = cat ? !cat.builtin : false;
                        return (
                          <DraggableHeader
                            key={header.id}
                            header={header}
                            canDelete={canDelete}
                            onDelete={() => {
                              if (cat) setPending({ kind: "category", category: cat });
                            }}
                          />
                        );
                      })}
                      <th style={{ width: 56, textAlign: "right" }}>
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
                    <td style={{ textAlign: "right", width: 56 }}>
                      <span className="row-actions">
                        <button
                          type="button"
                          className="icon-btn tip"
                          data-tip="Delete entry"
                          aria-label="Delete entry"
                          onClick={() =>
                            setPending({ kind: "entry", entry: row.original })
                          }
                        >
                          <TrashIcon />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>

      <ConfirmModal
        open={pending?.kind === "entry"}
        title="Delete this entry?"
        body="It moves to Trash — you can restore it from there. The original drivel is preserved."
        confirmLabel="Delete entry"
        destructive
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending?.kind !== "entry") return;
          await deleteEntry({
            roomId,
            entryId: pending.entry.id,
            deletedBy: identity,
          });
        }}
      />

      <ConfirmModal
        open={pending?.kind === "category"}
        title={
          pending?.kind === "category"
            ? `Delete column "${pending.category.label}"?`
            : "Delete column?"
        }
        body="The column disappears from the table. Each row's value is preserved — restore from Trash to bring the column back populated."
        confirmLabel="Delete column"
        destructive
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending?.kind !== "category") return;
          await deleteCategory({
            roomId,
            categoryId: pending.category.id,
            deletedBy: identity,
          });
        }}
      />
    </>
  );
}

function DraggableHeader({
  header,
  canDelete,
  onDelete,
}: {
  header: Header<Entry, unknown>;
  canDelete: boolean;
  onDelete: () => void;
}) {
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
        "header-cell",
        isDragging ? "is-dragging" : "",
        isOver && !isDragging ? "is-over" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="header-cell__inner">
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
        {canDelete && (
          <button
            type="button"
            className="header-cell__del icon-btn tip"
            data-tip="Delete column"
            aria-label="Delete column"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TrashIcon />
          </button>
        )}
      </span>
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
