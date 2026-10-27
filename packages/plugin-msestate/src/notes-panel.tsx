'use client'

import { useScene } from '@pascal-app/core'
import { sceneIdFromPath } from './capture'
import { NoteText } from './note-text'
import { type Note, showPiece, useNotes } from './notes'

const KIND_NAMES: Record<string, string> = {
  wall: 'Muro',
  block: 'Blocco',
  door: 'Porta',
  window: 'Finestra',
  slab: 'Pavimento',
  ceiling: 'Soffitto',
  zone: 'Stanza',
  stair: 'Scala',
  item: 'Oggetto',
  'imported-mesh': 'Oggetto',
}

const pieceName = (note: Note) => note.piece.label ?? KIND_NAMES[note.piece.kind] ?? note.piece.kind

function NoteRow({ note, gone }: { note: Note; gone: boolean }) {
  return (
    <li>
      <button
        className="flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent disabled:cursor-default disabled:hover:bg-transparent"
        disabled={gone}
        onClick={() => showPiece(note.piece.id)}
        title={gone ? undefined : 'Mostra il pezzo'}
        type="button"
      >
        <span className="truncate font-medium text-xs">
          {pieceName(note)}
          {gone && <span className="font-normal text-muted-foreground"> · pezzo eliminato</span>}
        </span>
        <NoteText note={note} />
      </button>
    </li>
  )
}

/** The project's notes: open ones first, newest on top; click one to see its piece. */
export default function NotesPanel() {
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const loaded = useNotes(sceneId)
  const nodes = useScene((s) => s.nodes)
  const notes = [...(loaded?.notes ?? [])].reverse()
  const open = notes.filter((note) => !note.done)
  const done = notes.filter((note) => note.done)
  const gone = (note: Note) => !(note.piece.id in nodes)

  return (
    <div className="flex flex-col gap-3 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Note</h2>
      {loaded?.error && <p className="text-destructive text-xs">{loaded.error}</p>}
      {loaded && !loaded.error && open.length === 0 && (
        <p className="text-sidebar-foreground/70 text-sm leading-5">
          Seleziona un pezzo e premi la nota nella sua scheda per lasciare un appunto.
        </p>
      )}
      {open.length > 0 && (
        <ul className="-mx-2 flex flex-col gap-0.5">
          {open.map((note) => (
            <NoteRow gone={gone(note)} key={note.id} note={note} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="group border-sidebar-border border-t pt-2">
          <summary className="cursor-pointer select-none text-sidebar-foreground/70 text-xs hover:text-sidebar-foreground">
            Fatte ({done.length})
          </summary>
          <ul className="-mx-2 mt-1 flex flex-col gap-0.5">
            {done.map((note) => (
              <NoteRow gone={gone(note)} key={note.id} note={note} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
