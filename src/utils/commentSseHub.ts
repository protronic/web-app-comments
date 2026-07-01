import { MESSAGE_TYPE } from '@opencloud-eu/web-client/sse'

export const COMMENT_SSE_EVENT_TYPES = [
  MESSAGE_TYPE.FILE_TOUCHED,
  MESSAGE_TYPE.POSTPROCESSING_FINISHED
] as const

export type CommentSseListener = (eventType: string, message: MessageEvent) => void

export interface CommentSseSource {
  addEventListener(type: string, listener: (message: MessageEvent) => void): void
  removeEventListener(type: string, listener: (message: MessageEvent) => void): void
}

const listeners = new Set<CommentSseListener>()
const boundHandlers = new Map<string, (message: MessageEvent) => void>()
let boundSource: CommentSseSource | undefined

function dispatch(eventType: string, message: MessageEvent): void {
  for (const listener of listeners) {
    listener(eventType, message)
  }
}

function bindHub(source: CommentSseSource): void {
  if (boundSource === source && boundHandlers.size > 0) {
    return
  }

  if (boundSource && boundSource !== source) {
    unbindHub(boundSource)
  }

  boundSource = source

  for (const eventType of COMMENT_SSE_EVENT_TYPES) {
    if (boundHandlers.has(eventType)) {
      continue
    }

    const handler = (message: MessageEvent) => {
      dispatch(eventType, message)
    }

    boundHandlers.set(eventType, handler)
    source.addEventListener(eventType, handler)
  }
}

function unbindHub(source: CommentSseSource): void {
  for (const [eventType, handler] of boundHandlers) {
    source.removeEventListener(eventType, handler)
  }

  boundHandlers.clear()

  if (boundSource === source) {
    boundSource = undefined
  }
}

export function subscribeCommentSse(
  source: CommentSseSource,
  listener: CommentSseListener
): () => void {
  listeners.add(listener)
  bindHub(source)

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0 && boundSource) {
      unbindHub(boundSource)
    }
  }
}

export function resetCommentSseHubForTests(): void {
  if (boundSource) {
    unbindHub(boundSource)
  }

  listeners.clear()
}
