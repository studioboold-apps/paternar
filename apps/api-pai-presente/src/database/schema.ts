/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

export { usersTable } from '../modules/User/user.table';
export {
  authIdentitiesTable,
  passwordCredentialsTable,
  sessionsTable,
} from '../modules/Auth/auth.table';
export { childrenTable } from '../modules/Child/child.table';
export { activitiesTable } from '../modules/Activity/activity.table';
export { insightRatingsTable } from '../modules/InsightRating/insight-rating.table';
export {
  communityPostsTable,
  communityPostLikesTable,
} from '../modules/CommunityPost/community-post.table';
export { communityCommentsTable } from '../modules/CommunityComment/community-comment.table';
export { chatMessagesTable } from '../modules/ChatMessage/chat-message.table';
export { childFilesTable } from '../modules/ChildFile/child-file.table';
export { childConsentsTable } from '../modules/ChildConsent/child-consent.table';
export { auditLogTable } from '../modules/Audit/audit.table';
export {
  familyValueOptionsTable,
  userFamilyValuesTable,
} from '../modules/FamilyValues/family-values.table';
export { aiUsageTable } from '../modules/AiUsage/ai-usage.table';
export { communityReportsTable } from '../modules/CommunityReport/community-report.table';
export { paymentEventsTable, subscriptionsTable } from '../modules/Billing/billing.table';
