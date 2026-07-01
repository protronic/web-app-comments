// #region agent log
export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix'
): void {
  const payload = {
    sessionId: '34a9fe',
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId
  }

  if (typeof console !== 'undefined') {
    console.info('[comments-debug:34a9fe]', JSON.stringify(payload))
  }
}
// #endregion
