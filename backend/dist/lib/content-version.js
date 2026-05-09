export { parseProfEmailSnapshot, profEmailSnapshotToText, serializeProfEmailSnapshot, } from "@/lib/prof-email-version";
export function documentTypeToEntityType(docType) {
    switch (docType) {
        case "sop_draft":
            return "SOP";
        case "cv":
            return "CV";
        default:
            return "OTHER";
    }
}
