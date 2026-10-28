/** Permintaan prefetch browser (`Purpose: prefetch` atau `Sec-Purpose` berisi "prefetch"). */
export function isPrefetchRequest(headers: Pick<Headers, "get">): boolean {
  const purpose = headers.get("purpose")?.toLowerCase() ?? "";
  const secPurpose = headers.get("sec-purpose")?.toLowerCase() ?? "";
  return purpose === "prefetch" || secPurpose.includes("prefetch");
}
