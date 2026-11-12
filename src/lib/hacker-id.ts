// Display IDs are separate from account UUIDs and secret check-in QR tokens.
export function generateHackerId(): string {
  const digits = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `H-${digits}`;
}

// Accept current IDs, older printed IDs, and the seven-digit shorthand.
// Migration 020 preserves the digits when converting stored HH- IDs to H-.
export function normalizeHackerId(input: string): string | null {
  const digits = input.trim().toUpperCase().replace(/^(?:HH|H)[\s-]*/, "");
  return /^\d{7}$/.test(digits) ? `H-${digits}` : null;
}
