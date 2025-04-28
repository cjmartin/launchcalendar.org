// date utility functions
export function formatDate(date: Date): string {
  // TODO: Implement date formatting
  return date.toISOString();
}

// Checks if two dates are on the same calendar day (UTC)
export function isSameDay(date1?: string, date2?: string): boolean {
  // Return false if either date is missing
  if (!date1 || !date2) return false;
  // Parse the input date strings into Date objects
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  // Compare year, month, and day in UTC
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

// Returns true if date1 and date2 are within the same day, or within 'days' days into the future from date1 (UTC)
export function isWithinDays(date1?: string, date2?: string, days: number = 0): boolean {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  // Set both dates to midnight UTC for day comparison
  d1.setUTCHours(0, 0, 0, 0);
  d2.setUTCHours(0, 0, 0, 0);
  const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}
