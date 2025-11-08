/**
 * Format view count for display
 * >= 1B: show as "X.XB"
 * >= 1M: show as "XM" (rounded)
 * < 1M: show as "XK" (rounded)
 */
export function formatViewCount(viewcount: number): string {
  if (viewcount >= 1_000_000_000) {
    return (viewcount / 1_000_000_000).toFixed(1) + 'B';
  } else if (viewcount >= 1_000_000) {
    return Math.round(viewcount / 1_000_000) + 'M';
  } else if (viewcount >= 1_000) {
    return Math.round(viewcount / 1_000) + 'K';
  }
  return viewcount.toString();
}

