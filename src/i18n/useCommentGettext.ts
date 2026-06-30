import { useGettext } from 'vue3-gettext'
import translations from '../../l10n/translations.json'
import { registerCommentTranslations } from './registerTranslations'

let registered = false

export function useCommentGettext() {
  if (!registered) {
    registerCommentTranslations(translations)
    registered = true
  }

  return useGettext()
}
