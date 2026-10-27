import { type AnyNode, type AnyNodeId, emitter, sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useSyncExternalStore } from 'react'
import { Box3, Vector3 } from 'three'
import { errorMessage, projectApi, replyOf } from './http'

/** What a note points at, kept with it so it still reads if the piece is later rebuilt or deleted. */
export type NotePiece = {
  id: string
  kind: string
  label: string | null
  at: [number, number, number]
}

/** A note on a piece; `done` is set by whoever handled it (the agent), with one line on what changed. */
export type Note = {
  id: string
  piece: NotePiece
  text: string
  created_at: string
  done: { at: string; what: string } | null
}

export type NoteChange =
  | { action: 'add'; piece: NotePiece; text: string }
  | { action: 'edit'; id: string; text: string }
  | { action: 'delete'; id: string }

/** The kinds that are pieces of the house; levels, guides and measurements are not. */
export const NOTE_KINDS = [
  'block',
  'box-vent',
  'cabinet',
  'cabinet-module',
  'ceiling',
  'chimney',
  'column',
  'cupola',
  'door',
  'dormer',
  'downspout',
  'duct-fitting',
  'duct-segment',
  'duct-terminal',
  'elevator',
  'eyebrow-vent',
  'fence',
  'fence-gate',
  'fence-opening',
  'floor-opening',
  'gutter',
  'hvac-equipment',
  'imported-mesh',
  'item',
  'lean-to-extension',
  'lineset',
  'liquid-line',
  'pipe-fitting',
  'pipe-segment',
  'pipe-trap',
  'procedural-item',
  'ridge-vent',
  'roof',
  'roof-segment',
  'separator',
  'shelf',
  'skylight',
  'slab',
  'solar-panel',
  'stair',
  'stair-segment',
  'turbine-vent',
  'wall',
  'window',
  'zone',
]

const round = (value: number) => Math.round(value * 1000) / 1000

/** Where a node sits: the centre of its drawn bounds, else its outline's centre (rooms), else its position. */
function placeOf(node: AnyNode): number[] {
  const object = sceneRegistry.nodes.get(node.id)
  const box = object ? new Box3().setFromObject(object) : null
  if (box && !box.isEmpty()) return box.getCenter(new Vector3()).toArray()
  const outline =
    'polygon' in node && Array.isArray(node.polygon) ? (node.polygon as number[][]) : []
  if (outline.length > 0) {
    const mean = (axis: number) =>
      outline.reduce((sum, p) => sum + (p[axis] ?? 0), 0) / outline.length
    return [mean(0), 0, mean(1)]
  }
  return 'position' in node && Array.isArray(node.position)
    ? (node.position as number[])
    : [0, 0, 0]
}

/** The piece reference for a node: id, kind, name and where it sits (Pascal metres, mm). */
export function pieceOf(node: AnyNode): NotePiece {
  return {
    id: node.id,
    kind: node.type,
    label: node.name ?? null,
    at: placeOf(node).map(round) as NotePiece['at'],
  }
}

/** Select the piece and turn the camera to it. */
export function showPiece(id: string) {
  useViewer.getState().setSelection({ selectedIds: [id] })
  emitter.emit('camera-controls:focus', { nodeId: id as AnyNodeId })
}

// One copy of the project's notes for the card and the panel, so a note added in one shows in the other.
type Loaded = { sceneId: string; notes: Note[]; error: string | null }
let current: Loaded | null = null
const listeners = new Set<() => void>()
const publish = (loaded: Loaded) => {
  current = loaded
  for (const listener of listeners) listener()
}

const api = (sceneId: string) => `${projectApi(sceneId)}/pascal/notes`

async function load(sceneId: string) {
  try {
    const response = await fetch(api(sceneId), { cache: 'no-store' })
    const { notes } = await replyOf<{ notes: Note[] }>(response, 'Note non disponibili')
    publish({ sceneId, notes, error: null })
  } catch (failure) {
    publish({ sceneId, notes: [], error: errorMessage(failure) })
  }
}

/** Apply one change on the server; the notes it returns replace ours. Throws the server's refusal. */
export async function changeNote(sceneId: string, change: NoteChange) {
  const response = await fetch(api(sceneId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(change),
  })
  const { notes } = await replyOf<{ notes: Note[] }>(response, 'Nota non salvata')
  publish({ sceneId, notes, error: null })
}

/** The project's notes, loaded once per scene and shared; null until they arrive. */
export function useNotes(sceneId: string | null): Loaded | null {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null,
  )
  useEffect(() => {
    if (sceneId && current?.sceneId !== sceneId) void load(sceneId)
  }, [sceneId])
  return snapshot?.sceneId === sceneId ? snapshot : null
}
