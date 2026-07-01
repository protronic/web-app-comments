export { WebdavPropertyDashboardStorage } from '../storage/WebdavPropertyDashboardStorage'
export type {
  CommentsDashboardApi,
  CommentsDashboardQuery,
  CommentsDashboardResult,
  DashboardAnsweredFilter,
  DashboardStatusFilter,
  DashboardThreadEntry
} from '../types'
export {
  filterDashboardEntries,
  isThreadAnswered,
  queryDashboardEntries,
  sortDashboardEntries
} from '../utils/dashboard'
export {
  resolveCommentDocumentTarget,
  resolveCommentDocumentTargets,
  type CommentDocumentRef
} from '../utils/resolveTarget'
export { getLastReplyComment, getCommentPreviewLine } from '../utils/comments'
export { loadDashboardSpaces } from '../utils/dashboardSpaces'
