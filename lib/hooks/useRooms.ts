"use client";

// Live subscription to top-level rooms. Filters out soft-deleted by
// default; trash view passes `includeDeleted: true`.

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Room } from "../types";

export function useRooms(opts?: { includeDeleted?: boolean }) {
  const includeDeleted = !!opts?.includeDeleted;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const db = getDbOrNull();
    if (!db) {
      setConfigured(false);
      setReady(true);
      return;
    }

    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as object) }) as Room,
        );
        setRooms(
          includeDeleted ? all : all.filter((r) => !r.deletedAt),
        );
        setReady(true);
      },
      () => setReady(true),
    );
    return unsub;
  }, [includeDeleted]);

  return { rooms, ready, configured };
}
