import type { Metadata } from "next";

import { MyTrips } from "./my-trips";

export const metadata: Metadata = {
  title: "Trip saya | Trip Card",
  robots: { index: false, follow: false },
};

export default function TripSayaPage() {
  return <MyTrips />;
}
