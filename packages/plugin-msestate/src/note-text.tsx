import type { Note } from './notes'

const date = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

/** A note's text and date; when handled, what changed. */
export function NoteText({ note }: { note: Note }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={`whitespace-pre-wrap text-sm leading-5 ${note.done ? 'text-muted-foreground' : ''}`}
      >
        {note.text}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{date(note.created_at)}</span>
      {note.done && (
        <span className="text-xs leading-4">
          Fatto {date(note.done.at)}: {note.done.what}
        </span>
      )}
    </span>
  )
}
