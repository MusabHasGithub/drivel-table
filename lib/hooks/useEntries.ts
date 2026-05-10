"use client";

// Live subscription to a room's entries (= rows).
// Sorted submittedAt-desc by default — newest at the top. Users can re-sort
// once the table loads (TanStack handles that client-side).

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Entry } from "../types";

export function useEntries(roomId: string | undefined) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const db = getDbOrNull();
    if (!db) {
      setReady(true);
      return;
    }
    const q = query(
      collection(db, "rooms", roomId, "entries"),
      orderBy("submittedAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as object) }) as Entry,
          ),
        );
        setReady(true);
      },
      () => setReady(true),
    );
    return unsub;
  }, [roomId]);

  return { entries, ready };
}
