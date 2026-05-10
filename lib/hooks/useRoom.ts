"use client";

// Live subscription to a single room doc.
//
// `notFound` distinguishes "Firestore returned, doc doesn't exist" from
// "we're still loading" — lets the room page show a 404-ish empty state
// instead of an infinite spinner when someone hits a bad URL.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDbOrNull } from "../firebase";
import type { Room } from "../types";

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const db = getDbOrNull();
    if (!db) {
      setReady(true);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "rooms", roomId),
      (snap) => {
        if (!snap.exists()) {
          setRoom(null);
          setNotFound(true);
          setReady(true);
          return;
        }
        setRoom({ id: snap.id, ...(snap.data() as object) } as Room);
        setNotFound(false);
        setReady(true);
      },
      () => setReady(true),
    );
    return unsub;
  }, [roomId]);

  return { room, ready, notFound };
}
