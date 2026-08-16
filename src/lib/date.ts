/** Today as YYYY-MM-DD in *local* time. Using the UTC date would file an
 *  evening session in Germany under the next day for half the year. */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const DAY = 86_400_000

/** "Today", "Yesterday", "3 days ago", then a plain date. */
export function relativeDay(date: string, from: string = today()): string {
  const days = Math.round((Date.parse(from) - Date.parse(date)) / DAY)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}
