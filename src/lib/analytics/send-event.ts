// Kirim event analytics dari klien ke POST /api/events. Tanpa cookie, tanpa
// identitas pengunjung. Tidak pernah melempar dan tidak ditunggu pemanggil.

import type { ClientEventName, EventTripType } from "./events";

export type ClientEventPayload = {
  event: ClientEventName;
  tripType?: EventTripType;
  tripId?: string;
};

const ENDPOINT = "/api/events";

export function sendEvent(payload: ClientEventPayload): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Blob application/json supaya server membaca body sebagai JSON.
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) {
        return;
      }
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics tidak boleh mengganggu pengguna.
  }
}
