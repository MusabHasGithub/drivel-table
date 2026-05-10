"use client";

// Live subscription to a room's categories (= columns).
// Sorted by `order` ascending so the table's default column order is stable
// across reloads.

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Category } from "../types";

export function useCategories(roomId: string | undefined) {
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
        setCategories(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as object) }) as Category,
          ),
        );
        setReady(true);
      },
      () => setReady(true),
    );
    return unsub;
  }, [roomId]);

  return { categories, ready };
}
