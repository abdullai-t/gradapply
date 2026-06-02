import { SchoolStatus } from "@prisma/client";

import {
  buildExampleSchool,
  buildExportWorkbook,
  parseSchoolExcelBuffer,
  prismaSchoolToExcelRow,
} from "@/lib/school-excel-template";
import { progressFromStatus } from "@/lib/school-progress";
import {
  requireWritableAccount,
  schoolTrackingLimitForUser,
} from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_SCHOOLS = 100;

function excelResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const exportExcel = withAuth(async (req, { userId }) => {
  const templateOnly =
    new URL(req.url).searchParams.get("template") === "1";

  if (templateOnly) {
    const buffer = buildExportWorkbook([buildExampleSchool()]);
    return excelResponse(buffer, "Grad-School-App-Tracker-Template.xlsx");
  }

  const [schools, profEmails] = await Promise.all([
    prisma.school.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }, { program: "asc" }],
    }),
    prisma.profEmail.findMany({
      where: { userId },
      select: { profName: true, profEmail: true, university: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const rows = schools.map((school) => prismaSchoolToExcelRow(school, profEmails));
  const buffer = buildExportWorkbook(rows);
  const date = new Date().toISOString().slice(0, 10);
  return excelResponse(buffer, `GradApply-Schools-${date}.xlsx`);
});

export const importExcel = withAuth(async (req, { userId }) => {
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return bad({ error: "Upload an Excel file (.xlsx) using the file field." });
  }

  if (file.size > MAX_FILE_BYTES) {
    return bad({ error: "File is too large (max 5 MB)." });
  }

  const name = file.name.toLowerCase();
  if (
    !name.endsWith(".xlsx") &&
    !name.endsWith(".xls") &&
    !name.endsWith(".csv")
  ) {
    return bad({
      error: "Unsupported file type. Use .xlsx, .xls, or .csv from the template.",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseSchoolExcelBuffer(buffer);

  if (parsed.schools.length === 0) {
    return bad({
      error:
        parsed.errors[0] ??
        "No schools found. Use the GradApply tracker template (university name row, then headers, then program rows).",
      details: { errors: parsed.errors, warnings: parsed.warnings },
    });
  }

  if (parsed.schools.length > MAX_IMPORT_SCHOOLS) {
    return bad({
      error: `Too many schools in file (max ${MAX_IMPORT_SCHOOLS} per import).`,
    });
  }

  const limit = await schoolTrackingLimitForUser(userId);
  const current = await prisma.school.count({ where: { userId } });
  const slotsLeft = limit - current;
  if (slotsLeft <= 0) {
    return bad(
      {
        error: `You can track up to ${limit} schools on your plan. Remove schools or upgrade before importing.`,
        code: "SCHOOL_LIMIT",
      },
      402,
    );
  }

  const toImport = parsed.schools.slice(0, slotsLeft);
  const skippedForLimit =
    parsed.schools.length > toImport.length
      ? parsed.schools.length - toImport.length
      : 0;

  let created = 0;
  let updated = 0;
  const importErrors: string[] = [...parsed.errors];
  let tracked = current;

  const existingKeys = new Set(
    (
      await prisma.school.findMany({
        where: {
          userId,
          OR: toImport.map((row) => ({
            name: row.name,
            program: row.program,
          })),
        },
        select: { name: true, program: true },
      })
    ).map((s) => `${s.name}\0${s.program}`),
  );

  for (const row of toImport) {
    try {
      const status = row.status ?? SchoolStatus.PLANNING;
      const data = {
        name: row.name,
        program: row.program,
        degree: row.degree || "Graduate",
        programUrl: row.programUrl,
        department: row.department,
        college: row.college,
        portalUrl: row.portalUrl,
        primaryProfessor: row.primaryProfessor,
        backupProfessors: row.backupProfessors,
        notes: row.notes,
        funding: row.funding,
        applicationFee: row.applicationFee,
        status,
        deadline: row.deadline,
        progress: progressFromStatus(status),
        requiredMaterials: row.requiredMaterials,
        letterRecommenders: row.letterRecommenders,
      };

      const key = `${row.name}\0${row.program}`;
      const isUpdate = existingKeys.has(key);

      if (!isUpdate && tracked >= limit) {
        importErrors.push(
          `Stopped at "${row.name}" — school limit reached.`,
        );
        break;
      }

      await prisma.school.upsert({
        where: {
          userId_name_program: {
            userId,
            name: row.name,
            program: row.program,
          },
        },
        create: { ...data, userId },
        update: data,
      });

      if (isUpdate) {
        updated += 1;
      } else {
        created += 1;
        tracked += 1;
        existingKeys.add(key);
      }
    } catch (e) {
      importErrors.push(
        `${row.name} / ${row.program}: ${e instanceof Error ? e.message : "import failed"}`,
      );
    }
  }

  return ok({
    created,
    updated,
    skippedForLimit,
    warnings: parsed.warnings,
    errors: importErrors,
  });
});
