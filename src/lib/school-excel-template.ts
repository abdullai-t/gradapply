import { SchoolStatus } from "@prisma/client";
import { format } from "date-fns";
import * as XLSX from "xlsx";

import { profEmailMatchesSchool } from "@/lib/prof-email-school-match";
import {
  normalizeLetterRecommenders,
  normalizeRequiredMaterials,
  type LetterRecommenderItem,
  type RequiredMaterialItem,
} from "@/lib/school-tracker-defaults";

/** Column indices matching the URSP grad-school tracker spreadsheet. */
export const COL = {
  PROGRAM: 0,
  PROGRAM_LINK: 1,
  DEPARTMENT: 2,
  COLLEGE: 3,
  APPLICATION_LINK: 4,
  PRIMARY_PROF: 5,
  BACKUP_PROFS: 6,
  MATERIAL_LABEL: 7,
  MATERIAL_DONE: 8,
  LETTER_NAME: 9,
  LETTER_DONE: 10,
  NOTES: 11,
  STATUS: 12,
} as const;

export const TRACKER_HEADER_ROW = [
  "Program Name/Focus",
  "Program Link",
  "Department",
  "College",
  "Application Link",
  "Primary Professor/Contact",
  "Backup Professors/Contact",
  "Required Materials",
  "",
  "Letters of Recommendation",
  "",
  "Notes",
  "Application Status",
] as const;

export const EXAMPLE_UNIVERSITY = "Example University";
export const GENERAL_TRACKER_SHEET_NAME = "General Tracker";
export const SHEET_NAME = "University 1";

/** URSP “General Tracker” summary columns (one row per program). */
export const GENERAL_TRACKER_HEADERS = [
  "University",
  "Program Name/Focus",
  "Department",
  "College",
  "Application Deadline",
  "Application Status",
  "General Contact",
  "Application Fee",
  "Required Materials",
  "GRE",
  "LOR",
  "Funding Opportunities",
  "Notes",
  "Admission Decision Date",
] as const;

const GENERAL_COL = {
  UNIVERSITY: 0,
  PROGRAM: 1,
  DEPARTMENT: 2,
  COLLEGE: 3,
  DEADLINE: 4,
  STATUS: 5,
  CONTACT: 6,
  FEE: 7,
  MATERIALS: 8,
  GRE: 9,
  LOR: 10,
  FUNDING: 11,
  NOTES: 12,
  DECISION: 13,
} as const;

export const META_APPLICATION_STATUS = "Application Status";
export const META_DEADLINE = "Deadline";
export const META_PROFESSOR_OUTREACH = "Professor Outreach";

export type ProfessorOutreachRow = {
  name: string;
  email: string;
};

export type SchoolExcelRow = {
  name: string;
  program: string;
  degree: string;
  programUrl: string | null;
  department: string | null;
  college: string | null;
  portalUrl: string | null;
  primaryProfessor: string | null;
  backupProfessors: string | null;
  notes: string | null;
  status: SchoolStatus;
  deadline: Date | null;
  funding: string | null;
  applicationFee: string | null;
  professorOutreach: ProfessorOutreachRow[];
  requiredMaterials: RequiredMaterialItem[];
  letterRecommenders: LetterRecommenderItem[];
};

type SheetMeta = {
  status?: SchoolStatus;
  deadline?: Date | null;
  professors: ProfessorOutreachRow[];
};

export type ParseSchoolExcelResult = {
  schools: SchoolExcelRow[];
  errors: string[];
  warnings: string[];
};

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function rowCells(row: unknown, maxCol: number = COL.STATUS): string[] {
  if (!Array.isArray(row)) return [];
  const out: string[] = [];
  for (let i = 0; i <= maxCol; i++) {
    out[i] = cellStr(row[i]);
  }
  return out;
}

function isGeneralTrackerHeaderRow(row: string[]): boolean {
  return (
    row[GENERAL_COL.UNIVERSITY] === GENERAL_TRACKER_HEADERS[0] &&
    row[GENERAL_COL.PROGRAM] === GENERAL_TRACKER_HEADERS[1]
  );
}

function parseGeneralTrackerMaterialsCell(value: string): RequiredMaterialItem[] {
  const labels = value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (labels.length === 0) return [];
  return labels.map((label) => ({
    id: newId(),
    label,
    done: false,
  }));
}

export function parseGeneralTrackerRows(rows: unknown[][]): SchoolExcelRow[] {
  if (rows.length === 0) return [];
  const header = rowCells(rows[0], GENERAL_COL.DECISION);
  if (!isGeneralTrackerHeaderRow(header)) return [];

  const schools: SchoolExcelRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rowCells(rows[i], GENERAL_COL.DECISION);
    if (r.every((c) => !c)) continue;
    const name = r[GENERAL_COL.UNIVERSITY];
    if (!name) continue;

    schools.push({
      name,
      program: r[GENERAL_COL.PROGRAM] || "General program",
      degree: "Graduate",
      programUrl: null,
      department: r[GENERAL_COL.DEPARTMENT] || null,
      college: r[GENERAL_COL.COLLEGE] || null,
      portalUrl: null,
      primaryProfessor: r[GENERAL_COL.CONTACT] || null,
      backupProfessors: null,
      notes: r[GENERAL_COL.NOTES] || null,
      status: parseStatusCell(r[GENERAL_COL.STATUS]),
      deadline: parseDeadlineCell(r[GENERAL_COL.DEADLINE]),
      funding: r[GENERAL_COL.FUNDING] || null,
      applicationFee: r[GENERAL_COL.FEE] || null,
      professorOutreach: [],
      requiredMaterials: parseGeneralTrackerMaterialsCell(
        r[GENERAL_COL.MATERIALS] ?? "",
      ),
      letterRecommenders: [],
    });
  }
  return schools;
}

function mergeGeneralTrackerFields(
  school: SchoolExcelRow,
  fromGeneral: SchoolExcelRow,
): SchoolExcelRow {
  return {
    ...school,
    department: school.department ?? fromGeneral.department,
    college: school.college ?? fromGeneral.college,
    deadline: school.deadline ?? fromGeneral.deadline,
    status:
      school.status === SchoolStatus.PLANNING && fromGeneral.status !== SchoolStatus.PLANNING
        ? fromGeneral.status
        : school.status,
    funding: school.funding ?? fromGeneral.funding,
    applicationFee: school.applicationFee ?? fromGeneral.applicationFee,
    notes: school.notes ?? fromGeneral.notes,
    primaryProfessor: school.primaryProfessor ?? fromGeneral.primaryProfessor,
    requiredMaterials:
      school.requiredMaterials.length > 0
        ? school.requiredMaterials
        : fromGeneral.requiredMaterials,
  };
}

function schoolTrackerKey(name: string, program: string): string {
  return `${name.trim().toLowerCase()}|${program.trim().toLowerCase()}`;
}

export function parseBoolCell(v: unknown): boolean {
  const s = cellStr(v).toUpperCase();
  return s === "TRUE" || s === "YES" || s === "1" || s === "X" || s === "DONE";
}

export function parseDeadlineCell(v: unknown): Date | null {
  const s = cellStr(v);
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = iso ? new Date(`${s}T12:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDeadlineExport(deadline: Date | null): string {
  if (!deadline) return "";
  if (Number.isNaN(deadline.getTime())) return "";
  return format(deadline, "MMM d, yyyy");
}

function formatDeadlineGeneralTracker(deadline: Date | null): string {
  if (!deadline) return "";
  if (Number.isNaN(deadline.getTime())) return "";
  return format(deadline, "MMMM d, yyyy");
}

function formatGeneralContact(school: SchoolExcelRow): string {
  if (school.primaryProfessor?.trim()) return school.primaryProfessor.trim();
  const outreachEmail = school.professorOutreach.find((p) => p.email.trim())?.email;
  if (outreachEmail) return outreachEmail.trim();
  const outreachName = school.professorOutreach.find((p) => p.name.trim())?.name;
  if (outreachName) return outreachName.trim();
  if (school.portalUrl?.trim()) return school.portalUrl.trim();
  return "";
}

function formatMaterialsMultiline(materials: RequiredMaterialItem[]): string {
  return materials.map((m) => m.label).join("\n");
}

function formatLorColumn(letters: LetterRecommenderItem[]): string {
  const count = letters.length;
  if (count === 0) return "";
  return String(count);
}

export function isGeneralTrackerSheetName(sheetName: string): boolean {
  return sheetName.trim().toLowerCase() === GENERAL_TRACKER_SHEET_NAME.toLowerCase();
}

export function schoolToGeneralTrackerRow(school: SchoolExcelRow): unknown[] {
  return [
    school.name,
    school.program,
    school.department ?? "",
    school.college ?? "",
    formatDeadlineGeneralTracker(school.deadline),
    statusLabel(school.status),
    formatGeneralContact(school),
    school.applicationFee ?? "",
    formatMaterialsMultiline(school.requiredMaterials),
    "",
    formatLorColumn(school.letterRecommenders),
    school.funding ?? "",
    school.notes ?? "",
    "",
  ];
}

export function buildGeneralTrackerRows(schools: SchoolExcelRow[]): unknown[][] {
  const rows: unknown[][] = [[...GENERAL_TRACKER_HEADERS]];
  for (const school of schools) {
    rows.push(schoolToGeneralTrackerRow(school));
  }
  return rows;
}

export function sanitizeExcelSheetName(
  name: string,
  used: Set<string>,
): string {
  const invalid = /[:\\/?*\[\]]/g;
  let base = name.replace(invalid, " ").replace(/\s+/g, " ").trim();
  if (!base) base = "School";
  base = base.slice(0, 31);

  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function parseStatusCell(v: unknown): SchoolStatus {
  const s = cellStr(v).toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, SchoolStatus> = {
    PLANNING: SchoolStatus.PLANNING,
    APPLIED: SchoolStatus.APPLIED,
    WAITING: SchoolStatus.WAITING,
    ACCEPTED: SchoolStatus.ACCEPTED,
    REJECTED: SchoolStatus.REJECTED,
    WITHDRAWN: SchoolStatus.WITHDRAWN,
  };
  if (s in map) return map[s]!;
  const plain = cellStr(v);
  for (const [key, val] of Object.entries(map)) {
    if (plain.toLowerCase() === key.toLowerCase().replace(/_/g, " ")) {
      return val;
    }
  }
  return SchoolStatus.PLANNING;
}

function statusLabel(status: SchoolStatus): string {
  return status.replaceAll("_", " ");
}

function newId(): string {
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isHeaderRow(row: string[]): boolean {
  return row[COL.PROGRAM] === "Program Name/Focus";
}

function isUniversityRow(row: string[], next: string[] | undefined): boolean {
  if (!row[COL.PROGRAM] || isHeaderRow(row)) return false;
  if (row[COL.MATERIAL_LABEL] && !row[COL.PROGRAM_LINK] && !row[COL.DEPARTMENT]) {
    return false;
  }
  return next !== undefined && isHeaderRow(next);
}

function isMaterialContinuation(row: string[]): boolean {
  return !row[COL.PROGRAM] && Boolean(row[COL.MATERIAL_LABEL]);
}

function isMetaLabelRow(row: string[]): boolean {
  const label = row[0];
  return (
    label === META_APPLICATION_STATUS ||
    label === META_DEADLINE ||
    label === META_PROFESSOR_OUTREACH
  );
}

function parseMetaSection(
  rows: unknown[][],
  startIndex: number,
): { nextIndex: number; meta: SheetMeta } {
  let i = startIndex;
  const meta: SheetMeta = { professors: [] };

  while (i < rows.length) {
    const r = rowCells(rows[i]);
    if (isHeaderRow(r)) break;

    if (r[0] === META_APPLICATION_STATUS) {
      meta.status = parseStatusCell(r[1]);
      i += 1;
      continue;
    }
    if (r[0] === META_DEADLINE) {
      meta.deadline = parseDeadlineCell(r[1]);
      i += 1;
      continue;
    }
    if (r[0] === META_PROFESSOR_OUTREACH) {
      i += 1;
      if (i < rows.length) {
        const header = rowCells(rows[i]);
        if (header[0] === "Name" && header[1] === "Email") {
          i += 1;
        }
      }
      while (i < rows.length) {
        const pr = rowCells(rows[i]);
        if (isHeaderRow(pr)) break;
        const peek =
          i + 1 < rows.length ? rowCells(rows[i + 1]) : undefined;
        if (isUniversityRow(pr, peek)) break;
        if (isMetaLabelRow(pr)) break;
        if (pr.every((c) => !c)) {
          i += 1;
          break;
        }
        if (pr[0] === "Name" && pr[1] === "Email") break;
        meta.professors.push({
          name: pr[0] || "",
          email: pr[1] || "",
        });
        i += 1;
      }
      continue;
    }

    if (r.every((c) => !c)) {
      i += 1;
      continue;
    }
    break;
  }

  return { nextIndex: i, meta };
}

function parseSchoolBlock(
  universityName: string,
  dataRows: string[][],
  blockIndex: number,
  sheetMeta?: SheetMeta,
): { school: SchoolExcelRow | null; errors: string[] } {
  const errors: string[] = [];
  if (dataRows.length === 0) {
    errors.push(`Block ${blockIndex + 1} (${universityName}): no program rows found.`);
    return { school: null, errors };
  }

  const first = dataRows[0]!;
  const program = first[COL.PROGRAM] || "General program";
  const materials: RequiredMaterialItem[] = [];
  const letterSlots: LetterRecommenderItem[] = [];

  for (const dr of dataRows) {
    const matLabel = dr[COL.MATERIAL_LABEL];
    if (matLabel) {
      materials.push({
        id: newId(),
        label: matLabel,
        done: parseBoolCell(dr[COL.MATERIAL_DONE]),
      });
    }
    const letterName = dr[COL.LETTER_NAME];
    if (letterName) {
      letterSlots.push({
        id: newId(),
        name: letterName,
        done: parseBoolCell(dr[COL.LETTER_DONE]),
      });
    }
  }

  return {
    school: {
      name: universityName,
      program,
      degree: "Graduate",
      programUrl: first[COL.PROGRAM_LINK] || null,
      department: first[COL.DEPARTMENT] || null,
      college: first[COL.COLLEGE] || null,
      portalUrl: first[COL.APPLICATION_LINK] || null,
      primaryProfessor: first[COL.PRIMARY_PROF] || null,
      backupProfessors: first[COL.BACKUP_PROFS] || null,
      notes: first[COL.NOTES] || null,
      status:
        sheetMeta?.status ?? parseStatusCell(first[COL.STATUS]),
      deadline: sheetMeta?.deadline ?? null,
      funding: null,
      applicationFee: null,
      professorOutreach: sheetMeta?.professors ?? [],
      requiredMaterials: materials,
      letterRecommenders: letterSlots,
    },
    errors,
  };
}

export function parseSchoolExcelRows(rows: unknown[][]): ParseSchoolExcelResult {
  const schools: SchoolExcelRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let i = 0;
  let blockIndex = 0;

  while (i < rows.length) {
    const row = rowCells(rows[i]);
    if (row.every((c) => !c)) {
      i += 1;
      continue;
    }

    if (isHeaderRow(row)) {
      i += 1;
      continue;
    }

    const next = i + 1 < rows.length ? rowCells(rows[i + 1]) : undefined;

    if (isUniversityRow(row, next)) {
      const universityName = row[COL.PROGRAM]!;
      i += 1;
      const { nextIndex, meta } = parseMetaSection(rows, i);
      i = nextIndex;
      if (i < rows.length && isHeaderRow(rowCells(rows[i]))) {
        i += 1;
      }
      const dataRows: string[][] = [];
      while (i < rows.length) {
        const dr = rowCells(rows[i]);
        if (dr.every((c) => !c)) {
          i += 1;
          break;
        }
        const peek = i + 1 < rows.length ? rowCells(rows[i + 1]) : undefined;
        if (isUniversityRow(dr, peek)) break;
        if (isHeaderRow(dr)) {
          i += 1;
          break;
        }
        if (isMaterialContinuation(dr) || dr[COL.PROGRAM]) {
          dataRows.push(dr);
          i += 1;
          continue;
        }
        break;
      }

      const { school, errors: blockErrors } = parseSchoolBlock(
        universityName,
        dataRows,
        blockIndex,
        meta,
      );
      errors.push(...blockErrors);
      if (school) {
        if (isExampleTemplateSchool(school)) {
          warnings.push("Skipped example template row.");
        } else {
          schools.push(school);
        }
      }
      blockIndex += 1;
      continue;
    }

    i += 1;
  }

  return { schools, errors, warnings };
}

function isExampleTemplateSchool(school: SchoolExcelRow): boolean {
  const name = school.name.toLowerCase();
  const isExampleName =
    name === "example university" ||
    name === "example uni" ||
    name === EXAMPLE_UNIVERSITY.toLowerCase();
  return (
    isExampleName &&
    school.program.toLowerCase().includes("example") &&
    school.department?.toLowerCase() === "sociology"
  );
}

function sheetRowsFromWorkbook(
  wb: XLSX.WorkBook,
  sheetName: string,
): unknown[][] {
  const sheet = wb.Sheets[sheetName]!;
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
}

function parseSingleSchoolSheetRows(
  rows: unknown[][],
  sheetName: string,
  blockIndex: number,
): { school: SchoolExcelRow | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let i = 0;
  while (i < rows.length && rowCells(rows[i]).every((c) => !c)) {
    i += 1;
  }
  if (i >= rows.length) {
    errors.push(`Sheet "${sheetName}": no data.`);
    return { school: null, errors, warnings };
  }

  const first = rowCells(rows[i]);
  const universityName = first[COL.PROGRAM] || sheetName;
  i += 1;

  const { nextIndex, meta } = parseMetaSection(rows, i);
  i = nextIndex;
  if (i < rows.length && isHeaderRow(rowCells(rows[i]))) {
    i += 1;
  }

  const dataRows: string[][] = [];
  while (i < rows.length) {
    const dr = rowCells(rows[i]);
    if (dr.every((c) => !c)) break;
    if (isHeaderRow(dr)) {
      i += 1;
      continue;
    }
    if (isMaterialContinuation(dr) || dr[COL.PROGRAM]) {
      dataRows.push(dr);
      i += 1;
      continue;
    }
    break;
  }

  const { school, errors: blockErrors } = parseSchoolBlock(
    universityName,
    dataRows,
    blockIndex,
    meta,
  );
  errors.push(...blockErrors);
  if (school && isExampleTemplateSchool(school)) {
    warnings.push(`Skipped example sheet "${sheetName}".`);
    return { school: null, errors, warnings };
  }
  return { school, errors, warnings };
}

export function parseSchoolExcelBuffer(buffer: Buffer): ParseSchoolExcelResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (wb.SheetNames.length === 0) {
    return { schools: [], errors: ["Workbook has no sheets."], warnings: [] };
  }

  const generalByKey = new Map<string, SchoolExcelRow>();
  for (const sheetName of wb.SheetNames) {
    if (!isGeneralTrackerSheetName(sheetName)) continue;
    const rows = sheetRowsFromWorkbook(wb, sheetName);
    for (const row of parseGeneralTrackerRows(rows)) {
      generalByKey.set(schoolTrackerKey(row.name, row.program), row);
    }
  }

  const attachGeneral = (school: SchoolExcelRow): SchoolExcelRow => {
    const extra = generalByKey.get(schoolTrackerKey(school.name, school.program));
    return extra ? mergeGeneralTrackerFields(school, extra) : school;
  };

  if (wb.SheetNames.length > 1) {
    const schools: SchoolExcelRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let blockIndex = 0;

    for (const sheetName of wb.SheetNames) {
      if (isGeneralTrackerSheetName(sheetName)) continue;
      const rows = sheetRowsFromWorkbook(wb, sheetName);
      const result = parseSingleSchoolSheetRows(rows, sheetName, blockIndex);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      if (result.school) {
        schools.push(attachGeneral(result.school));
      }
      blockIndex += 1;
    }

    if (schools.length === 0 && generalByKey.size > 0) {
      for (const row of generalByKey.values()) {
        if (!isExampleTemplateSchool(row)) {
          schools.push(row);
        }
      }
    }

    return { schools, errors, warnings };
  }

  const sheetName = wb.SheetNames[0]!;
  const rows = sheetRowsFromWorkbook(wb, sheetName);
  if (isGeneralTrackerHeaderRow(rowCells(rows[0], GENERAL_COL.DECISION))) {
    const schools = parseGeneralTrackerRows(rows).filter(
      (s) => !isExampleTemplateSchool(s),
    );
    return { schools, errors: [], warnings: [] };
  }

  const parsed = parseSchoolExcelRows(rows);
  return {
    ...parsed,
    schools: parsed.schools.map(attachGeneral),
  };
}

export function schoolToTrackerRows(school: SchoolExcelRow): unknown[][] {
  const out: unknown[][] = [];
  out.push([school.name]);
  out.push([META_APPLICATION_STATUS, statusLabel(school.status)]);
  out.push([META_DEADLINE, formatDeadlineExport(school.deadline)]);
  if (school.professorOutreach.length > 0) {
    out.push([META_PROFESSOR_OUTREACH]);
    out.push(["Name", "Email"]);
    for (const prof of school.professorOutreach) {
      out.push([prof.name, prof.email]);
    }
  }
  out.push([]);
  out.push([...TRACKER_HEADER_ROW]);

  const materials = school.requiredMaterials;
  const letters = school.letterRecommenders;
  const rowCount = Math.max(materials.length, letters.length, 1);

  for (let i = 0; i < rowCount; i++) {
    const line: unknown[] = Array(COL.STATUS + 1).fill("");
    if (i === 0) {
      line[COL.PROGRAM] = school.program;
      line[COL.PROGRAM_LINK] = school.programUrl ?? "";
      line[COL.DEPARTMENT] = school.department ?? "";
      line[COL.COLLEGE] = school.college ?? "";
      line[COL.APPLICATION_LINK] = school.portalUrl ?? "";
      line[COL.PRIMARY_PROF] = school.primaryProfessor ?? "";
      line[COL.BACKUP_PROFS] = school.backupProfessors ?? "";
      line[COL.NOTES] = school.notes ?? "";
      line[COL.STATUS] = statusLabel(school.status);
    }
    const mat = materials[i];
    if (mat) {
      line[COL.MATERIAL_LABEL] = mat.label;
      line[COL.MATERIAL_DONE] = mat.done ? "TRUE" : "FALSE";
    }
    const letter = letters[i];
    if (letter) {
      line[COL.LETTER_NAME] = letter.name;
      line[COL.LETTER_DONE] = letter.done ? "TRUE" : "FALSE";
    }
    out.push(line);
  }

  out.push([]);
  return out;
}

export function buildExampleSchool(): SchoolExcelRow {
  return {
    name: "Example Uni",
    program: "Example Studies",
    degree: "Graduate",
    programUrl: null,
    department: "Sociology",
    college: "Social & Behavioral Sciences",
    portalUrl: null,
    primaryProfessor: "generic.email@blank.edu",
    backupProfessors: null,
    notes: "",
    status: SchoolStatus.PLANNING,
    deadline: new Date("2024-12-31T12:00:00"),
    applicationFee: "$85",
    funding: [
      "TA/TO/PA/RA",
      "CPE",
      "REAL",
      "Summer",
      "PDF",
      "Fellowships/Grants",
      "External",
      "Scholarships",
    ].join("\n"),
    professorOutreach: [
      { name: "Dr. Example", email: "prof.example@university.edu" },
    ],
    requiredMaterials: [
      { id: "ex-m1", label: "Res/CV", done: false },
      { id: "ex-m2", label: "Personal Statement", done: false },
      { id: "ex-m3", label: "Writing Sample", done: false },
      { id: "ex-m4", label: "Transcripts", done: false },
    ],
    letterRecommenders: [
      { id: "ex-l1", name: "Dr. Example", done: false },
      { id: "ex-l2", name: "Dr. Example", done: false },
      { id: "ex-l3", name: "Dr. Example", done: false },
    ],
  };
}

export function buildExampleTemplateRows(): unknown[][] {
  return schoolToTrackerRows(buildExampleSchool());
}

export function buildWorkbookBuffer(
  rows: unknown[][],
  sheetName = SHEET_NAME,
): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

export function buildExportWorkbook(schools: SchoolExcelRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>([
    GENERAL_TRACKER_SHEET_NAME.toLowerCase(),
  ]);

  const generalWs = XLSX.utils.aoa_to_sheet(buildGeneralTrackerRows(schools));
  XLSX.utils.book_append_sheet(wb, generalWs, GENERAL_TRACKER_SHEET_NAME);

  for (const school of schools) {
    const rows = schoolToTrackerRows(school);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const tab = sanitizeExcelSheetName(school.name, usedSheetNames);
    XLSX.utils.book_append_sheet(wb, ws, tab);
  }

  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

type ProfEmailForExport = {
  profName: string | null;
  profEmail: string | null;
  university: string | null;
};

export function prismaSchoolToExcelRow(
  school: {
    name: string;
    program: string;
    degree: string;
    programUrl: string | null;
    department: string | null;
    college: string | null;
    portalUrl: string | null;
    primaryProfessor: string | null;
    backupProfessors: string | null;
    notes: string | null;
    status: SchoolStatus;
    deadline: Date | null;
    funding: string | null;
    applicationFee: string | null;
    requiredMaterials: unknown;
    letterRecommenders: unknown;
  },
  profEmails: ProfEmailForExport[] = [],
): SchoolExcelRow {
  const professorOutreach = profEmails
    .filter((p) => profEmailMatchesSchool(p, school))
    .map((p) => ({
      name: p.profName?.trim() || "",
      email: p.profEmail?.trim() || "",
    }))
    .filter((p) => p.name || p.email);

  return {
    name: school.name,
    program: school.program,
    degree: school.degree,
    programUrl: school.programUrl,
    department: school.department,
    college: school.college,
    portalUrl: school.portalUrl,
    primaryProfessor: school.primaryProfessor,
    backupProfessors: school.backupProfessors,
    notes: school.notes,
    status: school.status,
    deadline: school.deadline,
    funding: school.funding,
    applicationFee: school.applicationFee,
    professorOutreach,
    requiredMaterials: normalizeRequiredMaterials(school.requiredMaterials),
    letterRecommenders: normalizeLetterRecommenders(school.letterRecommenders),
  };
}
