import type { EditorHostPanel } from '@pascal-app/editor'

/** Lucide "camera", as one path: the rail draws `svg` icons offline, unlike iconify names. */
const CAMERA_PATH =
  'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8z'

/** Studio: renders of the current view, recorded with the scene they show. */
export const studioHostPanel: EditorHostPanel = {
  id: 'msestate:studio',
  label: 'Studio',
  icon: { kind: 'svg', viewBox: '0 0 24 24', path: CAMERA_PATH },
  component: () => import('./studio-panel'),
  description: 'Render della vista corrente: Gemini o Cycles, con la scena che mostrano.',
  creator: { name: 'MS Estate' },
}
