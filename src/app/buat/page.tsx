import type { Metadata } from "next";

import { todayJakarta, upcomingMonths } from "@/lib/trip/dates";

import { TripForm } from "./trip-form";

export const metadata: Metadata = {
  title: "Buat trip | Trip Card",
};

// Tanggal "hari ini" dan daftar bulan dihitung per permintaan, bukan saat build.
export const dynamic = "force-dynamic";

export default function BuatPage() {
  return <TripForm today={todayJakarta()} months={upcomingMonths()} />;
}
