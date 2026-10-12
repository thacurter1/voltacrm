/** Invalidates async results when a newer selection or session takes over. */
export function createOperationGuard() {
  let version = 0;
  return {
    begin: () => ++version,
    isCurrent: (operation: number) => operation === version,
    invalidate: () => { version++; },
  };
}
