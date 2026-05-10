"use client";

// Live subscription to the top-level `rooms` collection.
//
// Returns:
//   - rooms: ordered newest-first
//   - ready: false until the first snapshot lands (so the UI can show a
//            spinner instead of "no rooms yet" during the network round-trip)
//   - configured: false when Firebase env vars aren't set — UI should show
//            an actionable "configure Firebase" empty state in that case
//            rather than a generic "no rooms"

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Room } from "../types";

export function useRooms() {
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
        setRooms(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as object) }) as Room,
          ),
        );
        setReady(true);
      },
      () => {
        // On permission errors etc. mark ready so the UI can show an
        // empty state rather than spinning forever.
        setReady(true);
      },
    );
    return unsub;
  }, []);

  return { rooms, ready, configured };
}
