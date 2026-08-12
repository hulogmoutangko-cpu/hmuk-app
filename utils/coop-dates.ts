/**
 * Determines the official Cooperative Posting Date based on payment date.
 * - Payments on or before 15th post on the 15th of the current month.
 * - Payments after 15th post on the last day of the current month.
 */
export function getCoopPostingDate(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  if (day <= 15) {
    const postingDate = new Date(year, month, 15);
    return postingDate.toISOString().split('T')[0];
  } else {
    // Day 0 of month + 1 resolves to the last day of the current month
    const postingDate = new Date(year, month + 1, 0);
    return postingDate.toISOString().split('T')[0];
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}