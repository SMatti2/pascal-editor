import type { LazyComponent, Plugin } from '@pascal-app/core'
import type { EditorHostPanel } from '@pascal-app/editor'
import { NOTE_KINDS } from './notes'

/** Lucide "camera", as one path: the rail draws `svg` icons offline, unlike iconify names. */
const CAMERA_PATH =
  'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8z'

/** Studio: renders of the current view, recorded with the scene they show. */
export const studioHostPanel: EditorHostPanel = {
  id: 'msestate:studio',
  label: 'Studio',
  icon: { kind: 'svg', viewBox: '0 0 24 24', path: CAMERA_PATH },
  component: () => import('./studio-panel'),
  description: 'Render della vista corrente con Antigravity, legati alla scena e alla camera.',
  creator: { name: 'MS Estate' },
}

/** A page with its corner cut, filled: the rail and card draw `svg` icons with one filled path. */
const NOTE_PATH = 'M5 3h10l6 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'
const noteIcon = { kind: 'svg', viewBox: '0 0 24 24', path: NOTE_PATH } as const

/** Note: the open notes on pieces, to see what is left and jump to each piece. */
export const notesHostPanel: EditorHostPanel = {
  id: 'msestate:notes',
  label: 'Note',
  icon: noteIcon,
  component: () => import('./notes-panel'),
  description: 'Appunti su muri, porte e oggetti: cosa cambiare o verificare. L’agente li legge.',
  creator: { name: 'MS Estate' },
}

/** The note section on every piece's card: select it, press the note icon, write, Enter. */
export const msestatePlugin: Plugin = {
  id: 'msestate',
  apiVersion: 1,
  inspectorExtensions: [
    {
      id: 'msestate:note',
      pluginId: '', // no install gate: notes are on in every project
      kinds: NOTE_KINDS,
      icon: noteIcon,
      title: 'Nota',
      // the host passes `{ node }`; the contract types the component without props
      component: () => import('./note-card') as ReturnType<LazyComponent>,
    },
  ],
}
