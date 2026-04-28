/**
 * Shared types for the documents feature.
 *
 * `FolderSummary` is what the `/api/folders` GET endpoint returns — a folder
 * with the count of documents currently in it.
 */
export type FolderSummary = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  count: number;
  createdAt: string;
  updatedAt: string;
};
