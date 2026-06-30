import type { Translations } from 'vue3-gettext'
import { useGettext } from 'vue3-gettext'

export function registerCommentTranslations(catalog: Translations): void {
  const language = useGettext()
  const existing = language.translations || {}
  const merged: Translations = { ...existing }

  for (const [lang, entries] of Object.entries(catalog)) {
    if (!entries || typeof entries !== 'object' || Object.keys(entries).length === 0) {
      continue
    }

    merged[lang] = {
      ...(merged[lang] || {}),
      ...entries
    }
  }

  language.translations = merged
}
