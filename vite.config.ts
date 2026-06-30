import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'comments',
  test: {
    exclude: ['**/e2e/**']
  }
})
