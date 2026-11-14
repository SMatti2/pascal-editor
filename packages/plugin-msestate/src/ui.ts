/* What the Foto panel's tabs share: the date they print and their button and field styles. */

export const when = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const PRIMARY = `rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 ${FOCUS}`

export const SMALL = `rounded px-2 py-0.5 font-medium text-xs hover:bg-accent/50 disabled:opacity-50 ${FOCUS}`

export const FIELD =
  'rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'
