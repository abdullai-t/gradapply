import type { ContentEntityType } from "@prisma/client";

export {
  parseProfEmailSnapshot,
  profEmailSnapshotToText,
  serializeProfEmailSnapshot,
  type ProfEmailSnapshot,
} from "@/lib/prof-email-version";

export function documentTypeToEntityType(
  docType: string,
): ContentEntityType {
  switch (docType) {
    case "sop_draft":
      return "SOP";
    case "cv":
      return "CV";
    default:
      return "OTHER";
  }
}
