import { commentMessages } from '../../src/i18n/messages'
import translations from '../../l10n/translations.json'

describe('comment translations', () => {
  const messageValues = Object.values(commentMessages)

  it('keeps de and en catalogs in sync with message constants', () => {
    for (const message of messageValues) {
      expect(translations.de[message as keyof typeof translations.de]).toBeTruthy()
      expect(translations.en[message as keyof typeof translations.en]).toBe(message)
    }
  })
})
