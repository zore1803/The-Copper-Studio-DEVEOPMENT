/**
 * One-time backfill: regenerate project codes/names and invoice numbers on
 * EVERY existing record to match the current naming standard:
 *   - Project code: CS-<4 letters of company name>-<project # for that company>-<MMYY>
 *   - Project name: <Company name>-project <project # for that company>-<MMYY>
 *   - Invoice number: CS/INV/<legal year Apr-Mar>/<sequence within that year>
 *
 * The project number is per-company (1st, 2nd, 3rd... project THAT company has),
 * not the company's own rank, so a company with several projects gets distinct
 * codes/names for each one instead of duplicates.
 *
 * This OVERWRITES every project's name field, even ones already hand-edited
 * (per product decision: custom names belong in the project description, not
 * the name field). It does not touch the description field.
 *
 * Uses the app's normal model layer, so it follows whichever DB_DRIVER is
 * active (defaults to Supabase in this project; set DB_DRIVER=mongo + MONGO_URI
 * to target Mongo instead).
 *
 * Usage:
 *   node server/scripts/backfillProjectAndInvoiceIds.js          # dry run, prints a diff, writes nothing
 *   node server/scripts/backfillProjectAndInvoiceIds.js --commit  # actually writes the changes
 */
import "dotenv/config";
import mongoose from "mongoose";
import { dbDriver } from "../db/defineModel.js";
import Company from "../models/Company.js";
import Project from "../models/Project.js";
import Invoice from "../models/Invoice.js";
import { legalYearLabel } from "../services/invoiceNumber.js";

const COMMIT = process.argv.includes("--commit");

function companyCodeFromName(name) {
  const letters = String(name || "").toUpperCase().replace(/[^A-Z]/g, "");
  const seen = new Set();
  let code = "";
  for (const ch of letters) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    code += ch;
    if (code.length === 4) break;
  }
  return code.padEnd(4, "X");
}

function projectCodeFor(companyName, num, date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `CS-${companyCodeFromName(companyName)}-${String(num).padStart(2, "0")}-${mm}${yy}`;
}

function projectNameFor(companyName, num, date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${companyName}-project ${num}-${mm}${yy}`;
}

async function connectIfNeeded() {
  if (dbDriver !== "mongo") return;
  if (!process.env.MONGO_URI) throw new Error("DB_DRIVER=mongo but MONGO_URI is missing.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
}

async function backfillProjects() {
  const companies = await Company.find({}).select("_id name createdAt");
  const companyById = new Map(companies.map((c) => [String(c._id), c]));

  const projects = await Project.find({}).select("_id name companyId projectCode projectId createdAt");
  // Number each project 1, 2, 3... in creation order WITHIN its own company.
  const byCompany = new Map();
  for (const project of projects) {
    const key = String(project.companyId);
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(project);
  }
  const numberByProjectId = new Map();
  for (const group of byCompany.values()) {
    const ordered = [...group].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    ordered.forEach((project, index) => numberByProjectId.set(String(project._id), index + 1));
  }

  let changed = 0;
  for (const project of projects) {
    const company = companyById.get(String(project.companyId));
    if (!company) {
      console.warn(`[skip] project ${project._id} has no linked company`);
      continue;
    }
    const num = numberByProjectId.get(String(project._id));
    const date = project.createdAt ? new Date(project.createdAt) : new Date();
    const nextCode = projectCodeFor(company.name, num, date);
    const nextName = projectNameFor(company.name, num, date);

    if (project.name !== nextName || project.projectCode !== nextCode) {
      changed++;
      console.log(`[project ${project._id}] name: "${project.name}" -> "${nextName}" | code: "${project.projectCode || ""}" -> "${nextCode}"`);
      if (COMMIT) {
        await Project.findByIdAndUpdate(project._id, { $set: { name: nextName, projectCode: nextCode, projectId: nextCode } });
      }
    }
  }
  console.log(`Projects: ${changed} of ${projects.length} need changes.${COMMIT ? " (committed)" : " (dry run — pass --commit to apply)"}`);
}

async function backfillInvoices() {
  const invoices = await Invoice.find({}).select("_id invoiceNumber issueDate date createdAt");
  const ordered = [...invoices].sort((a, b) => {
    const da = new Date(a.issueDate || a.date || a.createdAt || 0);
    const db_ = new Date(b.issueDate || b.date || b.createdAt || 0);
    return da - db_;
  });

  const seqByYear = new Map();
  let changed = 0;

  for (const invoice of ordered) {
    const date = new Date(invoice.issueDate || invoice.date || invoice.createdAt || Date.now());
    const fy = legalYearLabel(date);
    const seq = (seqByYear.get(fy) || 0) + 1;
    seqByYear.set(fy, seq);
    const nextNumber = `CS/INV/${fy}/${String(seq).padStart(2, "0")}`;

    if (invoice.invoiceNumber !== nextNumber) {
      changed++;
      console.log(`[invoice ${invoice._id}] invoiceNumber: "${invoice.invoiceNumber}" -> "${nextNumber}"`);
      if (COMMIT) {
        await Invoice.findByIdAndUpdate(invoice._id, { $set: { invoiceNumber: nextNumber, invoiceId: nextNumber } });
      }
    }
  }
  console.log(`Invoices: ${changed} of ${invoices.length} need changes.${COMMIT ? " (committed)" : " (dry run — pass --commit to apply)"}`);
}

async function main() {
  await connectIfNeeded();
  console.log(`DB driver: ${dbDriver}${COMMIT ? " — COMMIT MODE" : " — dry run"}`);
  await backfillProjects();
  await backfillInvoices();
  if (dbDriver === "mongo") await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
