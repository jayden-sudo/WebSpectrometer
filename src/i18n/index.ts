// Multi-language (§15): original key names preserved, switching takes effect immediately
// locales/*.json are the source of truth, checked in directly (originally converted
// from the upstream program's Lang/*.txt files; CHT is our own Traditional Chinese addition)
import { useAppState } from '../app/store'
import { EXTRA_KEYS } from './extra'
import CHI from './locales/CHI.json'
import CHT from './locales/CHT.json'
import ENG from './locales/ENG.json'
import FRA from './locales/FRA.json'
import ITA from './locales/ITA.json'
import POR from './locales/POR.json'

export type LangCode = 'ENG' | 'ITA' | 'FRA' | 'POR' | 'CHI' | 'CHT'

export const LANGUAGES: LangCode[] = ['ENG', 'ITA', 'FRA', 'POR', 'CHI', 'CHT']

const dicts: Record<LangCode, Record<string, string>> = {
  CHI: CHI as Record<string, string>,
  CHT: CHT as Record<string, string>,
  ENG: ENG as Record<string, string>,
  FRA: FRA as Record<string, string>,
  ITA: ITA as Record<string, string>,
  POR: POR as Record<string, string>,
}

export function translate(lang: LangCode, key: string): string {
  return (
    dicts[lang]?.[key] ??
    EXTRA_KEYS[lang]?.[key] ??
    dicts.ENG[key] ??
    EXTRA_KEYS.ENG[key] ??
    key
  )
}

// For components: translation function reading the current language from the store (centralizes the language resolution rule)
export function useT(): (key: string) => string {
  const { settings } = useAppState()
  const lang = settings.Language as LangCode
  return (key) => translate(lang, key)
}
