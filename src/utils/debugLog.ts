// #region agent log
export const COMMENTS_NAV_DEBUG_BUILD = 'nav-dual-v10'

export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix'
): void {
  const payload = {
    sessionId: '3743bc',
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId
  }

  if (typeof console !== 'undefined') {
    console.info(`[comments-debug:3743bc] ${message}`, {
      location,
      hypothesisId,
      runId,
      build: COMMENTS_NAV_DEBUG_BUILD,
      ...data
    })
    console.info('[comments-debug:3743bc:json]', JSON.stringify(payload))
  }

  const canUseIngest =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  if (canUseIngest && typeof fetch !== 'undefined') {
    fetch('http://127.0.0.1:7503/ingest/747bd5f4-f3a4-45e5-904c-c3f0c707b48e', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '3743bc'
      },
      body: JSON.stringify(payload)
    }).catch(() => {})
  }
}
// #endregion
