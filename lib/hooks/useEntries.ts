"use client";

// Live subscription to a room's entries. Filters out soft-deleted by
// default (deletedAt set); pass `includeDeleted: true` to surface them
// for the trash view.

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Entry } from "../types";

export function useEntries(
  roomId: string | undefined,
  opts?: { includeDeleted?: boolean },
) {
  const includeDeleted = !!opts?.includeDeleted;
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
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as object) }) as Entry,
        );
        setEntries(
          includeDeleted ? all : all.filter((e) => !e.deletedAt),
        );
        setReady(true);
      },
      () => setReady(true),
    );
    return unsub;
  }, [roomId, includeDeleted]);

  return { entries, ready };
}
