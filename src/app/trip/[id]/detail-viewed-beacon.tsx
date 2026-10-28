"use client";

import { useEffect, useRef } from "react";

import { sendEvent } from "@/lib/analytics/send-event";
import { readMyTrips } from "@/lib/trip/local-storage";

/**
 * Mencatat `detail_viewed` satu kali per pemuatan halaman. Dicatat dari klien
 * supaya crawler pratinjau link (yang tidak menjalankan JS) tidak terhitung.
 * Pembuat yang membuka trip miliknya sendiri (ada di "Trip saya" browser ini)
 * tidak dihitung. Tidak merender apa pun.
 */
export function DetailViewedBeacon({ tripId }: { tripId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // readMyTrips tidak melempar bila storage tidak tersedia; dibungkus lagi
    // supaya apa pun yang terjadi tidak mengganggu halaman.
    try {
      if (readMyTrips().some((t) => t.id === tripId)) return;
    } catch {
      // Storage tidak bisa dibaca: anggap bukan pembuat.
    }
    sendEvent({ event: "detail_viewed", tripId });
  }, [tripId]);

  return null;
}
