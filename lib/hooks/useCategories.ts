"use client";

// Live subscription to a room's categories. Filters out soft-deleted
// by default; trash view passes `includeDeleted: true`.

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Category } from "../types";

export function useCategories(
  roomId: string | undefined,
  opts?: { includeDeleted?: boolean },
) {
  const includeDeleted = !!opts?.includeDeleted;
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const db = getDbOrNull();
    if (!db) {
      setReady(true);
      return;
    }
    const q = query(
      collection(db, "rooms", roomId, "categories"),
      orderBy("order", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as object) }) as Category,
        );
        setCategories(
          includeDeleted ? all : all.filter((c) => !c.deletedAt),
        );
        setReady(true);
      },
      () => setReady(true),
    );
    return unsub;
  }, [roomId, includeDeleted]);

  return { categories, ready };
}
