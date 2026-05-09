// @ts-nocheck
/** Curated lists for school & profile forms (stored as plain strings in the DB). */
export const DEGREE_OPTIONS = [
    "PhD",
    "ScD / DSc",
    "EdD",
    "MS",
    "MSc",
    "MA",
    "MEng",
    "MBA",
    "MPP / MPA",
    "JD",
    "MD",
    "Post-bacc certificate",
    "Other",
];
export const PROGRAM_OPTIONS = [
    "Computer Science",
    "Electrical & Computer Engineering",
    "Mechanical Engineering",
    "Civil / Environmental Engineering",
    "Aerospace Engineering",
    "Statistics / Biostatistics",
    "Applied Mathematics",
    "Physics",
    "Chemistry",
    "Biology / Life Sciences",
    "Neuroscience",
    "Psychology",
    "Economics",
    "Political Science",
    "Public Policy / Public Administration",
    "Business (PhD)",
    "Education",
    "Medicine / Biomedical Sciences",
    "Law",
    "Other",
];
/** Include a legacy DB value in the menu when it is not in the curated list. */
export function optionsWithFallback(curated, current) {
    const c = (current ?? "").trim();
    if (!c)
        return [...curated];
    const list = curated;
    return list.includes(c) ? [...curated] : [...curated, c];
}
