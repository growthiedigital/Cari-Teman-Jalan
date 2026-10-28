import { resolveReportContact } from "@/lib/report-contact";

type Props = {
  /** Tambahkan kalimat untuk pembuat yang kehilangan link edit (layar /sukses). */
  lostEditLink?: boolean;
  className?: string;
};

/** Footer kontak untuk lapor/minta hapus (NEXT_PUBLIC_REPORT_CONTACT). Komponen server. */
export function ReportContactFooter({
  lostEditLink = false,
  className = "mx-auto w-full max-w-lg px-5 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400",
}: Props) {
  const report = resolveReportContact(process.env.NEXT_PUBLIC_REPORT_CONTACT);
  const contact = report.href ? (
    <a href={report.href} className="font-semibold underline">
      {report.text}
    </a>
  ) : (
    <span className="font-semibold">{report.text}</span>
  );

  return (
    <footer className={className}>
      Ada masalah dengan trip ini atau mau minta dihapus? Hubungi {contact}
      {lostEditLink && (
        <>
          . Kalau link edit hilang, hubungi {contact} untuk minta penghapusan.
        </>
      )}
    </footer>
  );
}
