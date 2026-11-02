export interface CardStats {
  /** Lernstufe 0 (neu) bis 4 (sicher) */
  box: number
  correct: number
  wrong: number
  last: string | null
}

export interface Card {
  id: string
  term: string
  definition: string
  example?: string
  starred: boolean
  stats: CardStats
}

export interface TestRecord {
  date: string
  score: number
  total: number
}

export interface StudySet {
  id: string
  title: string
  description: string
  termLang: string
  defLang: string
  folder: string
  created: string
  updated: string
  lastStudied: string | null
  cards: Card[]
  tests: TestRecord[]
}

export interface SetSummary {
  id: string
  title: string
  description: string
  termLang: string
  defLang: string
  folder: string
  created: string
  updated: string
  lastStudied: string | null
  count: number
  known: number
  learning: number
  fresh: number
}

export interface CardInput {
  id?: string
  term: string
  definition: string
  example?: string
  starred?: boolean
}

export interface SetInput {
  title?: string
  description?: string
  termLang?: string
  defLang?: string
  folder?: string
  cards?: CardInput[]
}

export interface ProgressResult {
  cardId: string
  correct: boolean
}

export interface Sheet {
  name: string
  rows: string[][]
}

export type ExportFormat = 'xlsx' | 'csv' | 'txt' | 'json'

/** Brücke zwischen Oberfläche und Hauptprozess (window.api) */
export interface Api {
  listSets(): Promise<SetSummary[]>
  getSet(id: string): Promise<StudySet | null>
  createSet(data: SetInput): Promise<StudySet>
  updateSet(id: string, data: SetInput): Promise<StudySet | null>
  deleteSet(id: string): Promise<boolean>
  addCards(id: string, cards: CardInput[]): Promise<number>
  updateCard(id: string, cardId: string, patch: Partial<CardInput>): Promise<Card | null>
  recordProgress(id: string, results: ProgressResult[], test?: { score: number; total: number }): Promise<void>
  resetProgress(id: string): Promise<void>
  /** Öffnet einen Dateidialog und liest Excel/CSV. null = abgebrochen */
  pickSpreadsheet(): Promise<{ name: string; sheets: Sheet[] } | null>
  readSpreadsheet(name: string, data: ArrayBuffer): Promise<Sheet[]>
  exportSet(id: string, format: ExportFormat): Promise<string | null>
  exportTemplate(): Promise<string | null>
  dataFile(): Promise<string>
  onDataChanged(cb: () => void): () => void
}
