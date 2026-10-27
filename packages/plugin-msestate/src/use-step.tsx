import { useState } from 'react'
import { errorMessage } from './http'

type Step =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'done'; label: string }
  | { kind: 'error'; message: string }

/** One action's progress line: run(busy text, work, done text) shows each stage and any error. */
export function useStep() {
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const run = async (busy: string, work: () => Promise<unknown>, done?: string) => {
    setStep({ kind: 'busy', label: busy })
    try {
      await work()
      setStep(done ? { kind: 'done', label: done } : { kind: 'idle' })
    } catch (error) {
      setStep({ kind: 'error', message: errorMessage(error) })
    }
  }
  const line =
    step.kind === 'idle' ? null : step.kind === 'error' ? (
      <p className="text-destructive text-xs" role="alert">
        {step.message}
      </p>
    ) : (
      <p className="text-sidebar-foreground/70 text-xs" role="status">
        {step.label}
      </p>
    )
  return { busy: step.kind === 'busy', run, line }
}
