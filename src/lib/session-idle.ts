export type IdleSessionStatus = {
  activeAt: number | null;
  isActive: boolean;
};

/** Sign out only when a stamp exists and is older than the idle window. */
export function shouldSignOutIdleSession(status: IdleSessionStatus): boolean {
  return status.activeAt !== null && !status.isActive;
}
