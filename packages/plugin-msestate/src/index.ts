import type { LazyComponent, Plugin } from '@pascal-app/core'
import type { EditorHostPanel } from '@pascal-app/editor'
import { NOTE_KINDS } from './notes'

/** Lucide "camera", as one path: the rail draws `svg` icons offline, unlike iconify names. */
const CAMERA_PATH =
  'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8z'

/** Foto: the current view made a photo with Antigravity or Blender, every photo of the project below. */
export const fotoHostPanel: EditorHostPanel = {
  id: 'msestate:studio', // kept from the Studio panel it replaces, so projects keep it installed
  label: 'Foto',
  icon: { kind: 'svg', viewBox: '0 0 24 24', path: CAMERA_PATH },
  component: () => import('./foto-panel'),
  description: 'Foto realistiche della vista corrente, con Antigravity o Blender.',
  creator: { name: 'MS Estate' },
}

/**
 * A floor plan, filled: the outer wall frame (clockwise) with the rooms cut out
 * (counter-clockwise), one inner wall with a door gap.
 */
const PLAN_PATH = 'M3 3h18v18H3z M5 5v14h6v-4h2v4h6V5h-6v6h-2V5z'

/** Pianta: the scene drawn now as our 1:50 dimensioned plan, SVG and DXF. */
export const piantaHostPanel: EditorHostPanel = {
  id: 'msestate:pianta',
  label: 'Pianta',
  icon: { kind: 'svg', viewBox: '0 0 24 24', path: PLAN_PATH },
  component: () => import('./pianta-panel'),
  description: 'La pianta quotata 1:50 del modello com’è adesso, in SVG e DXF.',
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
