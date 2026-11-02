import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { SetSummary, StudySet } from '@shared/types'

interface AppState {
  /** Zählt hoch, wenn sich die Daten (z. B. durch den MCP-Server) geändert haben */
  version: number
  refresh(): void
  toast(msg: string): void
}

const Ctx = createContext<AppState>({ version: 0, refresh: () => {}, toast: () => {} })

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const toast = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])

  useEffect(() => window.api.onDataChanged(refresh), [refresh])

  return (
    <Ctx.Provider value={{ version, refresh, toast }}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <Check size={18} /> {msg}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useAppState = () => useContext(Ctx)

/** Lädt alle Sets; lädt neu, wenn sich die Daten ändern. */
export function useSets(): SetSummary[] | null {
  const { version } = useAppState()
  const [sets, setSets] = useState<SetSummary[] | null>(null)
  useEffect(() => {
    let live = true
    window.api.listSets().then((s) => live && setSets(s))
    return () => { live = false }
  }, [version])
  return sets
}

/** Lädt ein Set. live=false: nicht neu laden, während gelernt wird. undefined = lädt, null = nicht gefunden. */
export function useSet(id: string | undefined, live = true) {
  const { version } = useAppState()
  const [set, setSet] = useState<StudySet | null | undefined>(undefined)
  const dep = live ? version : 0
  useEffect(() => {
    if (!id) return
    let alive = true
    window.api.getSet(id).then((s) => alive && setSet(s))
    return () => { alive = false }
  }, [id, dep])
  return [set, setSet] as const
}
