/** A scoped UI can update visible rows, but must not delete unseen rows. */
export function mergeRecords<T extends { id: string }>(stored: T[], visible: T[]): T[] {
  const rows = new Map(stored.map(row => [row.id, row]));
  for (const row of visible) rows.set(row.id, row);
  return Array.from(rows.values());
}
