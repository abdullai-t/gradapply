export const ADMISSION_TERM_OPTIONS = [
    { value: "FALL", label: "Fall" },
    { value: "SPRING", label: "Spring" },
    { value: "SUMMER", label: "Summer" },
];
export function admissionTermLabel(term) {
    if (!term)
        return "";
    const row = ADMISSION_TERM_OPTIONS.find((o) => o.value === term);
    return row?.label ?? term;
}
