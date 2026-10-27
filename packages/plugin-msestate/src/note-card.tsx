'use client'

import type { AnyNode } from '@pascal-app/core'
import { useEffect, useRef, useState } from 'react'
import { sceneIdFromPath } from './capture'
import { errorMessage } from './http'
import { NoteText } from './note-text'
import { changeNote, type NoteChange, pieceOf, useNotes } from './notes'

/**
 * The note section of the selected piece's card: type and press Enter. The piece's id, kind,
 * name and position go with the note by themselves. Its earlier notes sit below; click one to
 * edit it.
 */
export default function NoteCard({ node }: { node: AnyNode }) {
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const loaded = useNotes(sceneId)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  // the section opens on purpose (the note icon), so the cursor goes straight to the text
  useEffect(() => input.current?.focus(), [])
  const notes = (loaded?.notes ?? []).filter((note) => note.piece.id === node.id).reverse()

  const send = async (change: NoteChange) => {
    if (!sceneId) return
    setBusy(true)
    try {
      await changeNote(sceneId, change)
      setDraft('')
      setEditing(null)
      setError(null)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  const save = () => {
    const text = draft.trim()
    if (!text || busy) return
    void send(
      editing
        ? { action: 'edit', id: editing, text }
        : { action: 'add', piece: pieceOf(node), text },
    )
  }
  const stopEditing = () => {
    setEditing(null)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <textarea
        aria-label={editing ? 'Modifica la nota' : 'Nuova nota su questo pezzo'}
        className="min-h-16 w-full resize-none rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        disabled={!sceneId}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            save()
          } else if (event.key === 'Escape' && editing) {
            event.stopPropagation()
            stopEditing()
          }
        }}
        placeholder="Cosa non va, cosa cambiare, cosa verificare…"
        ref={input}
        rows={2}
        value={draft}
      />
      <div className="flex min-h-5 items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>
          {busy
            ? 'Salvo…'
            : editing
              ? 'Invio salva · Esc annulla'
              : 'Invio salva · Maiusc+Invio a capo'}
        </span>
        {editing && (
          <button
            className="rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10"
            disabled={busy}
            onClick={() => void send({ action: 'delete', id: editing })}
            type="button"
          >
            Elimina
          </button>
        )}
      </div>
      {(error ?? loaded?.error) && (
        <p className="text-destructive text-xs">{error ?? loaded?.error}</p>
      )}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 border-border/50 border-t pt-2">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-accent/40 ${editing === note.id ? 'bg-accent/50' : ''}`}
                onClick={() => {
                  setEditing(note.id)
                  setDraft(note.text)
                  input.current?.focus()
                }}
                title="Modifica"
                type="button"
              >
                <NoteText note={note} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
