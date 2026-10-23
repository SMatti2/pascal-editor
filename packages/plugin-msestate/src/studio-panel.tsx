'use client'

/** The Studio rail panel. Empty shell: capture and models arrive in the next stories of epic 1. */
export default function StudioPanel() {
  return (
    <div className="flex flex-col gap-3 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Studio</h2>
      <p className="text-sidebar-foreground/60 text-sm">
        Render della vista corrente. Cattura e modelli in arrivo.
      </p>
    </div>
  )
}
