'use client'

import { SegmentedControl } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { sceneIdFromPath } from './capture'
import { RenderTab } from './render-tab'
import { PlaceTab, ReferencesTab } from './sources-tab'
import { staleViews, useSceneHash, useViews, ViewsTab } from './views-tab'

type Tab = 'luogo' | 'riferimenti' | 'viste' | 'render'
const TABS: { label: string; value: Tab }[] = [
  { label: 'Luogo', value: 'luogo' },
  { label: 'Riferimenti', value: 'riferimenti' },
  { label: 'Viste', value: 'viste' },
  { label: 'Render', value: 'render' },
]

/**
 * Foto, by what a picture is: the place as it is (Luogo), what guides the design and what will be
 * installed (Riferimenti), named cameras on the model shot again when it changes (Viste), and a
 * view made an ultra-realistic photo (Render).
 */
export default function FotoPanel() {
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  return sceneId ? <Tabs sceneId={sceneId} /> : null
}

/** The tabs stay mounted, so a switch keeps a brief, its references and the lists. */
function Tabs({ sceneId }: { sceneId: string }) {
  const projectId = useViewer((s) => s.projectId)
  const [tab, setTab] = useState<Tab>('viste')
  const [chosen, setChosen] = useState<string | null>(null)
  const { views, setViews, error } = useViews(sceneId)
  const hash = useSceneHash()
  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Foto</h2>
      <SegmentedControl onChange={setTab} options={TABS} value={tab} />
      <div hidden={tab !== 'luogo'}>
        <PlaceTab sceneId={sceneId} />
      </div>
      <div hidden={tab !== 'riferimenti'}>
        <ReferencesTab sceneId={sceneId} />
      </div>
      <div hidden={tab !== 'viste'}>
        <ViewsTab
          hash={hash}
          onPhoto={(view) => {
            setChosen(view.id)
            setTab('render')
          }}
          onViews={setViews}
          projectId={projectId}
          sceneId={sceneId}
          views={views}
        />
      </div>
      <div hidden={tab !== 'render'}>
        <RenderTab
          chosen={chosen}
          onChoose={setChosen}
          onViews={setViews}
          projectId={projectId}
          sceneId={sceneId}
          stale={staleViews(views, hash)}
          views={views}
        />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
