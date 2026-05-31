/** True when a TanStack mutation is running for a string id (e.g. delete by id). */
export function isMutationPendingForId(
  mutation: { isPending: boolean; variables?: string },
  id: string,
): boolean {
  return mutation.isPending && mutation.variables === id;
}

/** True when mutation variables include `{ id }` matching the target. */
export function isMutationPendingForObjectId(
  mutation: { isPending: boolean; variables?: { id: string } },
  id: string,
): boolean {
  return mutation.isPending && mutation.variables?.id === id;
}
