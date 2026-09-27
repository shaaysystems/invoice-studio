/** Pushes the footer to the bottom of the A4 page without reserving fixed space. */
export function InvoiceFooterlessSpacer() {
  return <div aria-hidden style={{ flex: "1 1 auto", minHeight: "8pt" }} />;
}
