export function profEmailPath(id: string): string {
  return `/emails/${encodeURIComponent(id)}`;
}

export function profEmailsIndexPath(): string {
  return "/emails";
}
