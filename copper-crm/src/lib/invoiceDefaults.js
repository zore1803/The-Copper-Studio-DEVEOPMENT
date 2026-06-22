// Invoice numbers: CS/INV/<legal year>/<sequence>, e.g. CS/INV/26-27/01.
// Legal year runs 1 Apr - 31 Mar, labeled by its two start/end years (e.g. "26-27").

export function legalYearLabel(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? year : year - 1; // April = month index 3
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

export function generateInvoiceNumber(invoices = [], date = new Date()) {
  const fy = legalYearLabel(date);
  const prefix = `CS/INV/${fy}/`;
  const countInYear = invoices.filter((invoice) => String(invoice.invoiceNumber || "").startsWith(prefix)).length;
  return `${prefix}${String(countInYear + 1).padStart(2, "0")}`;
}
