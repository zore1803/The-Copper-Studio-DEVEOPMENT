import Invoice from "../models/Invoice.js";

// Invoice numbers: CS/INV/<legal year>/<sequence>, e.g. CS/INV/26-27/01.
// Legal year runs 1 Apr - 31 Mar, labeled by its two start/end years (e.g. "26-27").

export function legalYearLabel(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? year : year - 1; // April = month index 3
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

export async function nextInvoiceNumber(date = new Date()) {
  const fy = legalYearLabel(date);
  const prefix = `CS/INV/${fy}/`;
  const matches = await Invoice.find({ invoiceNumber: new RegExp(`^${prefix.replace(/[/]/g, "\\/")}`) }).select("invoiceNumber");
  return `${prefix}${String(matches.length + 1).padStart(2, "0")}`;
}
