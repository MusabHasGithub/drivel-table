"use client";

// Per-user, per-room column order. Lives in localStorage so one user's
// reorder doesn't blast everyone else's view (the alternative — storing
// in Firestore — would do exactly that). Tradeoff: ordering doesn't sync
// across devices; acceptable for the friend-group scale.
//
// `categoryKeys` is the source-of-truth list (from useCategories, sorted
// by `order`). The hook merges:
//   1. The persisted user order (if any), filtered to currently-existing keys
//   2. Plus any new keys not in the persisted list, appended at the end
// — which is exactly what we want when a category is added: existing
// users keep their custom order, the new column slots in at the end of
// their view.

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "drivel.columnOrder.";

function storageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

function readPersisted(roomId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((x) => typeof x === "string")
    ) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function writePersisted(roomId: string, order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(roomId), JSON.stringify(order));
  } catch {
    // Quota exceeded etc. — ignore silently.
  }
}

export function useColumnOrder(roomId: string, categoryKeys: string[]) {
  const [columnOrder, setColumnOrderState] = useState<string[]>(categoryKeys);

  // Reconcile whenever the canonical list of keys changes (category added,
  // first hydration, etc.). Persisted values win for already-known keys;
  // unknown keys get appended.
  useEffect(() => {
    const persisted = readPersisted(roomId);
    if (!persisted) {
      setColumnOrderState(categoryKeys);
      return;
    }
    const valid = persisted.filter((k) => categoryKeys.includes(k));
    const newOnes = categoryKeys.filter((k) => !valid.includes(k));
    setColumnOrderState([...valid, ...newOnes]);
  }, [roomId, categoryKeys]);

  const setColumnOrder = useCallback(
    (next: string[]) => {
      setColumnOrderState(next);
      writePersisted(roomId, next);
    },
    [roomId],
  );

  return { columnOrder, setColumnOrder };
}
