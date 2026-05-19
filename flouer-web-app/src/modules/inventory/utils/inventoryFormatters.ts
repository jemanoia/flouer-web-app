export function getDaysUntil(expiryDate: string | null): number | null {
  if (!expiryDate) return null;

  const now = new Date();
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const msPerDay = 24 * 60 * 60 * 1000;

  return Math.ceil((expiry.getTime() - now.getTime()) / msPerDay);
}

export function getExpiryLabel(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry === null) return "No expiry";
  if (daysUntilExpiry < 0) return "Expired";
  if (daysUntilExpiry <= 7) return `Expiring in ${daysUntilExpiry}d`;
  return "In date";
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
