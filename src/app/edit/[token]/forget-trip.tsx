"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { hasMyTripWithToken, removeMyTripByToken } from "@/lib/trip/local-storage";

const subscribeNone = () => () => {};

/**
 * Di halaman "link edit tidak valid": bila browser ini punya entri dengan
 * token yang sama di "Trip saya" (trip sudah dihapus), tawarkan membuangnya.
 * Token dibaca dari path halaman ini (halaman not-found tidak menerima params);
 * tidak dikirim ke mana pun.
 */
export function ForgetTrip() {
  const pathname = usePathname();
  const token = pathname.split("/")[2] ?? "";
  const listed = useSyncExternalStore(
    subscribeNone,
    () => hasMyTripWithToken(token),
    () => false,
  );
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return (
      <p role="status" className="text-sm font-medium">
        Sudah dihapus dari daftar di perangkat ini.
      </p>
    );
  }
  if (!listed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        removeMyTripByToken(token);
        setRemoved(true);
      }}
      className="w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base font-semibold dark:border-zinc-700"
    >
      Hapus dari daftar di perangkat ini
    </button>
  );
}
