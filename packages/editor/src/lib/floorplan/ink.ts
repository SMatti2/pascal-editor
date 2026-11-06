import type { FloorplanGeometry } from '@pascal-app/core'

/**
 * msestate: the live 2D plan in plan ink, as an architecture studio draws it.
 * Kinds paint themselves in Pascal's slate greys; this maps every grey to a
 * neutral one: dark fills (what the plan cuts) become black poché, light fills
 * become white, edges become black, furniture edges a thinner grey. Coloured
 * paint (selection, hover, drafts, handles) is left as it is, so editing still
 * shows what it acts on. Zone outlines go: the room labels name the rooms.
 */

const INK = '#000000'
const FURNITURE_INK = '#5c5c5c'
const PAPER = '#ffffff'
/** Below this chroma (max − min channel, 0–1) a colour counts as a grey: Pascal's slates are 0.09–0.14, its accents 0.33 and up. */
const GREY_CHROMA = 0.2

const FURNITURE = new Set(['item', 'imported-mesh', 'cabinet', 'shelf'])

type Rgba = { r: number; g: number; b: number; a: number }

function parseColor(value: string): Rgba | null {
  const c = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((x) => x + x).join('') : hex[1]!
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
      a: 1,
    }
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(c)
  if (!fn) return null
  const [r, g, b, a] = fn[1]!.split(',').map((x) => Number.parseFloat(x))
  if ([r, g, b].some((x) => x === undefined || Number.isNaN(x))) return null
  return { r: r!, g: g!, b: b!, a: a === undefined || Number.isNaN(a) ? 1 : a }
}

/** HSL lightness and chroma, 0–1. */
function lightnessChroma({ r, g, b }: Rgba): [number, number] {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  return [(max + min) / 2, max - min]
}

function withAlpha(hex: string, a: number): string {
  if (a >= 1) return hex
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export function inkFill(type: string, fill: string | undefined): string | undefined {
  const c = fill ? parseColor(fill) : null
  if (!c) return fill
  const [l, s] = lightnessChroma(c)
  if (s >= GREY_CHROMA) return fill
  if (FURNITURE.has(type)) return withAlpha(PAPER, c.a)
  return withAlpha(l > 0.6 ? PAPER : INK, c.a)
}

/**
 * A grey wash (a slab, a block below the cut, any furniture or imported mesh): paper on
 * paper shows nothing and, stacked over a cut block (an IFC's finish layers), greys it,
 * so it goes transparent and keeps only its hit area. Pure white stays on everything
 * else: doors and windows mask the wall's gap with it.
 */
export function isWash(type: string, fill: string | undefined): boolean {
  const c = fill ? parseColor(fill) : null
  if (!c) return false
  const [l, s] = lightnessChroma(c)
  if (s >= GREY_CHROMA) return false
  if (FURNITURE.has(type)) return true
  return l > 0.6 && !(c.r === 255 && c.g === 255 && c.b === 255)
}

export function inkStroke(type: string, stroke: string | undefined): string | undefined {
  const c = stroke ? parseColor(stroke) : null
  if (!c) return stroke
  const [l, s] = lightnessChroma(c)
  if (s >= GREY_CHROMA) return stroke
  // light strokes are halos around labels and handles: keep them light
  if (l > 0.85) return withAlpha(PAPER, c.a)
  // mid greys are dashed overheads and secondary lines: keep them secondary
  const ink = FURNITURE.has(type) || l > 0.55 ? FURNITURE_INK : INK
  return withAlpha(ink, c.a)
}

export function inkFloorplan(
  type: string,
  geometry: FloorplanGeometry | null,
): FloorplanGeometry | null {
  if (!geometry) return geometry
  if (geometry.kind === 'group') {
    return { ...geometry, children: geometry.children.map((child) => inkFloorplan(type, child)!) }
  }
  if (geometry.kind === 'hatch' || geometry.kind === 'image') return geometry
  const g = geometry as FloorplanGeometry & { fill?: string; stroke?: string; fillOpacity?: number }
  const out = { ...g, fill: inkFill(type, g.fill), stroke: inkStroke(type, g.stroke) }
  if (g.kind !== 'text' && isWash(type, g.fill)) out.fillOpacity = 0
  if (type === 'zone' && g.fillOpacity === 0 && g.kind !== 'text') out.stroke = 'none'
  return out as FloorplanGeometry
}
