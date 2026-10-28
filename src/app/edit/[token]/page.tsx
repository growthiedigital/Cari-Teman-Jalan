import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { todayJakarta, upcomingMonths, withStoredMonths } from "@/lib/trip/dates";
import { findTripByToken } from "@/lib/trip/edit-queries";
import { tripRowToFormValues } from "@/lib/trip/form-values";

import { EditForm } from "./edit-form";

// Halaman rahasia: tidak diindeks, tidak membocorkan token lewat referrer.
// Header Cache-Control/X-Robots-Tag/Referrer-Policy diatur di next.config.ts.
export const metadata: Metadata = {
  title: "Edit trip | Trip Card",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Hasil bergantung pada token dan isi database: jangan di-cache.
export const dynamic = "force-dynamic";

export default async function EditPage({ params }: PageProps<"/edit/[token]">) {
  const { token } = await params;
  const row = await findTripByToken(token);
  if (!row) notFound();

  return (
    <EditForm
      token={token}
      tripId={row.id}
      type={row.type}
      initialValues={tripRowToFormValues(row)}
      stored={{
        type: row.type,
        startDate: row.start_date,
        endDate: row.end_date,
        monthStart: row.month_start,
        monthEnd: row.month_end,
      }}
      today={todayJakarta()}
      nowIso={new Date().toISOString()}
      isFull={row.is_full}
      months={withStoredMonths(upcomingMonths(), [row.month_start, row.month_end])}
    />
  );
}
