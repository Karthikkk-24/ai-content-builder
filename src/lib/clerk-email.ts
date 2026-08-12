/**
 * Prefer Clerk's primary email over email_addresses[0], which may be empty
 * or a secondary address.
 */
export function resolveClerkPrimaryEmail(
  emailAddresses:
    | Array<{ id?: string | null; email_address?: string | null }>
    | null
    | undefined,
  primaryEmailAddressId?: string | null
): string {
  if (!emailAddresses?.length) return "";

  if (primaryEmailAddressId) {
    const primary = emailAddresses.find(
      (entry) => entry.id === primaryEmailAddressId
    );
    if (primary?.email_address) return primary.email_address;
  }

  return emailAddresses[0]?.email_address || "";
}
