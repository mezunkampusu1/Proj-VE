-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('DATED', 'FIXED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('DATED', 'FIXED');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('PROJECT_CREATED', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_STATUS_CHANGED', 'TASK_ASSIGNED', 'TASK_DELETED', 'COMMENT_ADDED', 'TASK_COLUMN_CREATED', 'TASK_COLUMN_UPDATED', 'TASK_COLUMN_DELETED', 'RECURRING_TASK_CREATED', 'RECURRING_TASK_UPDATED', 'RECURRING_TASK_DELETED', 'MEMBER_JOINED', 'MEMBER_ROLE_CHANGED', 'DAILY_STAT_RECORDED', 'ANNOUNCEMENT_CREATED', 'ANNOUNCEMENT_UPDATED', 'ANNOUNCEMENT_DELETED', 'ANNOUNCEMENT_TYPE_CREATED', 'ANNOUNCEMENT_IMPORTED', 'DATE_CREATED', 'DATE_UPDATED', 'DATE_DELETED', 'DATE_TYPE_CREATED', 'DATE_IMPORTED', 'ATLAS_PROGRAM_CREATED', 'ATLAS_PROGRAM_UPDATED', 'ATLAS_PROGRAM_REMOVED', 'INSTITUTE_CREATED', 'INSTITUTE_UPDATED', 'INSTITUTE_DELETED', 'INSTITUTE_IMPORTED', 'FILE_UPLOADED', 'FILE_DELETED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED', 'UNIVERSITY_CREATED', 'UNIVERSITY_UPDATED', 'UNIVERSITY_IMPORTED', 'DAILY_FLOW_STARTED', 'DAILY_FLOW_BREAK_STARTED', 'DAILY_FLOW_BREAK_ENDED', 'DAILY_FLOW_COMPLETED', 'DAILY_FLOW_EDITED', 'DAILY_FLOW_REOPENED', 'DAILY_FLOW_SETTING_UPDATED', 'DOCUMENT_CREATED', 'DOCUMENT_UPDATED', 'DOCUMENT_DELETED', 'DOCUMENT_RESTORED', 'DOCUMENT_SHARED', 'DOCUMENT_STATUS_CHANGED', 'DOCUMENT_APPROVED', 'DOCUMENT_FOLDER_CREATED', 'FINANCE_RECORD_CREATED', 'FINANCE_RECORD_UPDATED', 'FINANCE_RECORD_DELETED', 'FINANCE_RECORD_STATUS_CHANGED', 'FINANCE_CATEGORY_CREATED', 'FINANCE_CATEGORY_UPDATED', 'FINANCE_CATEGORY_DELETED', 'FINANCE_RATE_UPDATED', 'FINANCE_RECURRING_CREATED', 'FINANCE_RECURRING_UPDATED', 'FINANCE_RECURRING_DELETED', 'FINANCE_PERMISSION_UPDATED', 'CONTENT_CREATED', 'CONTENT_UPDATED', 'CONTENT_DELETED', 'CONTENT_RESTORED', 'CONTENT_STATUS_CHANGED', 'CONTENT_APPROVED', 'CONTENT_REVISION_REQUESTED', 'CONTENT_PUBLISHED', 'CONTENT_ASSET_ADDED', 'CONTENT_ASSET_REMOVED', 'CONTENT_PERMISSION_UPDATED', 'DAILY_WORK_REPORT_SUBMITTED', 'DAILY_WORK_REPORT_REVIEWED', 'AI_CONTENT_GENERATED');

-- CreateEnum
CREATE TYPE "ModuleName" AS ENUM ('TASKS', 'ANNOUNCEMENTS', 'DATES', 'ATLAS', 'FILES', 'USER_REPORTS', 'TEAM', 'UNIVERSITIES', 'DAILY_FLOW', 'DOCUMENTS', 'FINANCE', 'CONTENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_COMMENT', 'TASK_MENTIONED', 'RECURRING_ASSIGNED', 'FILE_MENTIONED', 'ANNOUNCEMENT_MENTIONED', 'IMPORTANT_DATE_MENTIONED', 'ATLAS_PROGRAM_MENTIONED', 'TEAM_INVITED', 'DAILY_FLOW_EVENT', 'DOCUMENT_SHARED', 'DOCUMENT_MENTIONED', 'DOCUMENT_COMMENT', 'DOCUMENT_APPROVAL', 'DOCUMENT_UPDATE', 'FINANCE_PAYMENT_DUE', 'FINANCE_PAYMENT_OVERDUE', 'PROJECT_MENTIONED', 'CONTENT_MENTIONED', 'CONTENT_ASSIGNED', 'CONTENT_COMMENT', 'CONTENT_REVISION_REQUESTED', 'CONTENT_APPROVED', 'CONTENT_REJECTED', 'CONTENT_PUBLISH_REMINDER', 'CONTENT_DEADLINE_REMINDER', 'DAILY_WORK_REPORT_APPROVED', 'DAILY_WORK_REPORT_REVISION', 'GENERAL');

-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('YUKSEK_LISANS', 'DOKTORA');

-- CreateEnum
CREATE TYPE "AtlasChangeAction" AS ENUM ('CREATED', 'UPDATED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FileUploadKind" AS ENUM ('UPLOAD', 'LINK');

-- CreateEnum
CREATE TYPE "DailyFlowStatus" AS ENUM ('ACTIVE', 'ON_BREAK', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('VIEWER', 'COMMENTER', 'EDITOR', 'OWNER');

-- CreateEnum
CREATE TYPE "DocumentPermissionSubjectType" AS ENUM ('USER', 'TEAM', 'ROLE', 'EVERYONE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'BEING_REVISED', 'PENDING_APPROVAL', 'APPROVED', 'READY_TO_PUBLISH', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentSuggestionType" AS ENUM ('INSERT', 'DELETE', 'FORMAT', 'MOVE');

-- CreateEnum
CREATE TYPE "DocumentSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentAuditAction" AS ENUM ('CREATED', 'EDITED', 'DELETED', 'RESTORED', 'PERMANENTLY_DELETED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'SHARED', 'DOWNLOADED', 'EXPORTED', 'COMMENT_ADDED', 'COMMENT_DELETED', 'SUGGESTION_ACCEPTED', 'SUGGESTION_REJECTED', 'VERSION_RESTORED', 'OWNER_CHANGED', 'APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'REVISION_REQUESTED', 'APPROVAL_REJECTED', 'APPROVAL_WITHDRAWN');

-- CreateEnum
CREATE TYPE "FinanceRecordType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancePaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'AUTOMATIC_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceRecordStatus" AS ENUM ('PAID', 'PENDING', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinanceRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FinanceVisibility" AS ENUM ('ADMIN_ONLY', 'OWNER_AND_ADMIN', 'SPECIFIC_USERS', 'DEPARTMENT', 'TEAM');

-- CreateEnum
CREATE TYPE "FinanceRateSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "FinanceChangeAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'DELETED', 'RESTORED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'LINKEDIN', 'TWITTER', 'TIKTOK', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('IDEA', 'DRAFT', 'IN_PROGRESS', 'AWAITING_DESIGN', 'AWAITING_VIDEO', 'AWAITING_REVIEW', 'AWAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkCategory" AS ENUM ('SOCIAL_POST', 'CONTENT_CREATION', 'GRAPHIC_DESIGN', 'VIDEO_EDITING', 'REELS', 'STORY', 'BLOG_POST', 'SEO_WORK', 'GEO_WORK', 'KEYWORD_RESEARCH', 'COMPETITOR_ANALYSIS', 'WEBSITE_CONTENT_UPDATE', 'LANDING_PAGE_EDIT', 'UNIVERSITY_PROGRAM_DATA_ENTRY', 'ANNOUNCEMENT_ENTRY', 'PAGE_CHECK', 'BUG_CHECK', 'MODERATION', 'COMMENT_MANAGEMENT', 'REPORTING', 'OTHER');

-- CreateEnum
CREATE TYPE "SeoWorkType" AS ENUM ('KEYWORD_RESEARCH', 'CONTENT_OPTIMIZATION', 'TECHNICAL_SEO_CHECK', 'META_TITLE_EDIT', 'META_DESCRIPTION_EDIT', 'INTERNAL_LINKING', 'IMAGE_SEO', 'URL_EDIT', 'SCHEMA_WORK', 'COMPETITOR_ANALYSIS', 'SEARCH_CONSOLE_CHECK', 'SITEMAP_CHECK', 'BROKEN_LINK_CHECK', 'PAGE_SPEED_CHECK', 'CONTENT_UPDATE', 'GEO_OPTIMIZATION', 'AI_SEARCH_VISIBILITY');

-- CreateEnum
CREATE TYPE "WebsiteWorkType" AS ENUM ('TEXT_UPDATE', 'IMAGE_CHANGE', 'NEW_PAGE', 'PAGE_REMOVAL', 'MENU_EDIT', 'UNIVERSITY_INFO_UPDATE', 'PROGRAM_INFO_UPDATE', 'ANNOUNCEMENT_ADD', 'EVENT_ADD', 'BLOG_ADD', 'SEO_EDIT', 'BUG_FIX', 'FORM_UPDATE', 'UX_IMPROVEMENT', 'DATA_ENTRY', 'DATA_CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "DailyWorkReportStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ContentRevisionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ContentAssetRole" AS ENUM ('COVER', 'GALLERY', 'VIDEO', 'SCREENSHOT', 'DOCUMENT', 'SUBTITLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('BLOG_TOPIC_SUGGESTION', 'BLOG_DRAFT', 'TITLE_ALTERNATIVES', 'META_TITLE', 'META_DESCRIPTION', 'KEYWORD_SUGGESTIONS', 'CONTENT_OUTLINE', 'HEADING_STRUCTURE', 'SOCIAL_POST_TEXT', 'PLATFORM_REWRITE', 'INSTAGRAM_HASHTAGS', 'LINKEDIN_TEXT', 'TWITTER_TEXT', 'THREAD_GENERATION', 'TIKTOK_DESCRIPTION', 'FACEBOOK_TEXT', 'CTA_SUGGESTION', 'SHORTEN', 'LENGTHEN', 'PROOFREAD', 'TONE_CHANGE', 'SEO_ANALYSIS', 'GEO_SUGGESTIONS', 'DUPLICATE_DETECTION', 'QUALITY_SCORE');

-- CreateEnum
CREATE TYPE "AiOutputDecision" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "kind" "ProjectKind" NOT NULL DEFAULT 'DATED',
    "creatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "task_columns" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDoneColumn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "descriptionJson" JSONB,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "TaskKind" NOT NULL DEFAULT 'DATED',
    "scheduledDate" DATE,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "aiSummary" TEXT,
    "creatorId" TEXT NOT NULL,
    "recurringTemplateId" TEXT,
    "sourceDocumentId" TEXT,
    "sourceDocumentCommentId" TEXT,
    "documentBlockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "recurring_task_templates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_template_assignees" (
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_template_assignees_pkey" PRIMARY KEY ("templateId","userId")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" "FileUploadKind" NOT NULL DEFAULT 'UPLOAD',
    "fileName" TEXT,
    "storedPath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "externalUrl" TEXT,
    "showOnCard" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "userId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "message" TEXT NOT NULL,
    "module" "ModuleName",
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_user_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "newUserCount" INTEGER NOT NULL DEFAULT 0,
    "emailVerifiedCount" INTEGER NOT NULL DEFAULT 0,
    "phoneVerifiedCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "announcement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "entryDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_mentions" (
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "announcement_mentions_pkey" PRIMARY KEY ("announcementId","userId")
);

-- CreateTable
CREATE TABLE "announcement_tags" (
    "announcementId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "announcement_tags_pkey" PRIMARY KEY ("announcementId","tagId")
);

-- CreateTable
CREATE TABLE "important_date_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "important_date_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "important_dates" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "date" DATE,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "important_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "important_date_tags" (
    "importantDateId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "important_date_tags_pkey" PRIMARY KEY ("importantDateId","tagId")
);

-- CreateTable
CREATE TABLE "important_date_mentions" (
    "importantDateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "important_date_mentions_pkey" PRIMARY KEY ("importantDateId","userId")
);

-- CreateTable
CREATE TABLE "institutes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_programs" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degreeLevel" "DegreeLevel" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entryDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_program_tags" (
    "atlasProgramId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "atlas_program_tags_pkey" PRIMARY KEY ("atlasProgramId","tagId")
);

-- CreateTable
CREATE TABLE "atlas_program_mentions" (
    "atlasProgramId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "atlas_program_mentions_pkey" PRIMARY KEY ("atlasProgramId","userId")
);

-- CreateTable
CREATE TABLE "atlas_change_logs" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "action" "AtlasChangeAction" NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "universityId" TEXT,
    "kind" "FileUploadKind" NOT NULL DEFAULT 'UPLOAD',
    "title" TEXT,
    "description" TEXT,
    "fileName" TEXT,
    "storedPath" TEXT,
    "externalUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_mentions" (
    "fileUploadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "file_mentions_pkey" PRIMARY KEY ("fileUploadId","userId")
);

-- CreateTable
CREATE TABLE "daily_flow_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DailyFlowStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "totalActiveSeconds" INTEGER,
    "totalBreakSeconds" INTEGER,
    "breakCount" INTEGER,
    "reopenedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_flow_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_flow_breaks" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "actedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_flow_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_flow_edits" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_flow_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_flow_user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxBreakCount" INTEGER,
    "maxBreakMinutes" INTEGER,
    "maxTotalBreakMinutes" INTEGER,
    "standardStartMinute" INTEGER,
    "standardEndMinute" INTEGER,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_flow_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_flow_team_settings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "maxBreakCount" INTEGER,
    "maxBreakMinutes" INTEGER,
    "maxTotalBreakMinutes" INTEGER,
    "standardStartMinute" INTEGER,
    "standardEndMinute" INTEGER,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_flow_team_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_flow_notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onStart" BOOLEAN NOT NULL DEFAULT true,
    "onBreakStart" BOOLEAN NOT NULL DEFAULT false,
    "onBreakResume" BOOLEAN NOT NULL DEFAULT false,
    "onComplete" BOOLEAN NOT NULL DEFAULT true,
    "onBreakExceeded" BOOLEAN NOT NULL DEFAULT true,
    "onDayLeftOpen" BOOLEAN NOT NULL DEFAULT true,
    "onRecordEdited" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_flow_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "teamId" TEXT,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "typeId" TEXT,
    "folderId" TEXT,
    "teamId" TEXT,
    "projectId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastEditedById" TEXT,
    "content" JSONB,
    "contentText" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateCategory" TEXT,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedById" TEXT,
    "pinnedAt" TIMESTAMP(3),
    "publicShareToken" TEXT,
    "publicShareExpiresAt" TIMESTAMP(3),
    "publicSharePasswordHash" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spreadsheet_ops" (
    "id" SERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ops" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spreadsheet_ops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_permissions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "folderId" TEXT,
    "subjectType" "DocumentPermissionSubjectType" NOT NULL,
    "subjectUserId" TEXT,
    "subjectTeamId" TEXT,
    "subjectRole" "TeamRole",
    "level" "DocumentAccessLevel" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tags" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("documentId","tagId")
);

-- CreateTable
CREATE TABLE "document_favorites" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_favorites_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateTable
CREATE TABLE "document_followers" (
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_followers_pkey" PRIMARY KEY ("documentId","userId")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "anchorFrom" INTEGER,
    "anchorTo" INTEGER,
    "anchorText" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_suggestions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "DocumentSuggestionType" NOT NULL,
    "status" "DocumentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "anchorFrom" INTEGER,
    "anchorTo" INTEGER,
    "originalText" TEXT,
    "suggestedText" TEXT,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT,
    "label" TEXT,
    "isAutoSnapshot" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "currentApproverId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_audit_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "documentTitleSnapshot" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "DocumentAuditAction" NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_yjs_states" (
    "documentId" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_yjs_states_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "document_notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onShared" BOOLEAN NOT NULL DEFAULT true,
    "onMentioned" BOOLEAN NOT NULL DEFAULT true,
    "onComment" BOOLEAN NOT NULL DEFAULT true,
    "onApproval" BOOLEAN NOT NULL DEFAULT true,
    "onStatusChange" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_exchange_rates" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "rateToTry" DECIMAL(14,4) NOT NULL,
    "source" "FinanceRateSource" NOT NULL DEFAULT 'MANUAL',
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "FinanceRecordType" NOT NULL,
    "parentCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canViewFinance" BOOLEAN NOT NULL DEFAULT true,
    "canViewOwnRecords" BOOLEAN NOT NULL DEFAULT true,
    "canViewAllRecords" BOOLEAN NOT NULL DEFAULT false,
    "canCreateRecords" BOOLEAN NOT NULL DEFAULT true,
    "canEditOwnRecords" BOOLEAN NOT NULL DEFAULT true,
    "canEditAllRecords" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteRecords" BOOLEAN NOT NULL DEFAULT false,
    "canViewReports" BOOLEAN NOT NULL DEFAULT true,
    "canViewAttachments" BOOLEAN NOT NULL DEFAULT true,
    "canManageCategories" BOOLEAN NOT NULL DEFAULT false,
    "canManageRates" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_recurring_templates" (
    "id" TEXT NOT NULL,
    "type" "FinanceRecordType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "personId" TEXT NOT NULL,
    "payeeName" TEXT,
    "paymentMethod" "FinancePaymentMethod",
    "bankAccount" TEXT,
    "visibility" "FinanceVisibility" NOT NULL DEFAULT 'OWNER_AND_ADMIN',
    "departmentId" TEXT,
    "frequency" "FinanceRecurrenceFrequency" NOT NULL,
    "customIntervalDays" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextOccurrenceDate" DATE NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "type" "FinanceRecordType" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyId" TEXT NOT NULL,
    "rateToTry" DECIMAL(14,4) NOT NULL,
    "amountTry" DECIMAL(14,2) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "personId" TEXT NOT NULL,
    "payeeName" TEXT,
    "paymentMethod" "FinancePaymentMethod",
    "bankAccount" TEXT,
    "receiptNumber" TEXT,
    "status" "FinanceRecordStatus" NOT NULL DEFAULT 'PAID',
    "visibility" "FinanceVisibility" NOT NULL DEFAULT 'OWNER_AND_ADMIN',
    "departmentId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringTemplateId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "lastEditedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_record_visible_users" (
    "financeTransactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "finance_record_visible_users_pkey" PRIMARY KEY ("financeTransactionId","userId")
);

-- CreateTable
CREATE TABLE "finance_attachments" (
    "id" TEXT NOT NULL,
    "financeTransactionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transaction_tags" (
    "financeTransactionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "finance_transaction_tags_pkey" PRIMARY KEY ("financeTransactionId","tagId")
);

-- CreateTable
CREATE TABLE "finance_change_logs" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "action" "FinanceChangeAction" NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canViewModule" BOOLEAN NOT NULL DEFAULT true,
    "canViewAllContent" BOOLEAN NOT NULL DEFAULT false,
    "canViewOwnContent" BOOLEAN NOT NULL DEFAULT true,
    "canViewTeamContent" BOOLEAN NOT NULL DEFAULT false,
    "canCreateContent" BOOLEAN NOT NULL DEFAULT true,
    "canEditOwnContent" BOOLEAN NOT NULL DEFAULT true,
    "canEditAllContent" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteOwnContent" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteAllContent" BOOLEAN NOT NULL DEFAULT false,
    "canApproveContent" BOOLEAN NOT NULL DEFAULT false,
    "canRequestRevision" BOOLEAN NOT NULL DEFAULT false,
    "canScheduleContent" BOOLEAN NOT NULL DEFAULT false,
    "canMarkPublished" BOOLEAN NOT NULL DEFAULT false,
    "canManageBlog" BOOLEAN NOT NULL DEFAULT true,
    "canManageSeo" BOOLEAN NOT NULL DEFAULT true,
    "canManageWebsiteWork" BOOLEAN NOT NULL DEFAULT true,
    "canCreateDailyReport" BOOLEAN NOT NULL DEFAULT true,
    "canApproveDailyReport" BOOLEAN NOT NULL DEFAULT false,
    "canUploadFiles" BOOLEAN NOT NULL DEFAULT true,
    "canDeleteFiles" BOOLEAN NOT NULL DEFAULT false,
    "canComment" BOOLEAN NOT NULL DEFAULT true,
    "canMentionUsers" BOOLEAN NOT NULL DEFAULT true,
    "canViewReports" BOOLEAN NOT NULL DEFAULT true,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
    "canUseAi" BOOLEAN NOT NULL DEFAULT true,
    "canViewAiCosts" BOOLEAN NOT NULL DEFAULT false,
    "canViewActivityLog" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_contents" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "brandId" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "contentType" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'IDEA',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "postText" TEXT,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "hashtags" TEXT[],
    "mentionAccounts" TEXT[],
    "location" TEXT,
    "linkUrl" TEXT,
    "ctaText" TEXT,
    "targetAudience" TEXT,
    "contentGoal" TEXT,
    "campaign" TEXT,
    "keywords" TEXT[],
    "altText" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "designerId" TEXT,
    "videoEditorId" TEXT,
    "approvedById" TEXT,
    "publishedById" TEXT,
    "internalNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_content_performance" (
    "id" TEXT NOT NULL,
    "socialContentId" TEXT NOT NULL,
    "impressions" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "linkClicks" INTEGER,
    "followerGain" INTEGER,
    "videoWatchSeconds" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_content_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_contents" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "brandId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'IDEA',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "category" TEXT,
    "targetPage" TEXT,
    "slug" TEXT,
    "focusKeyword" TEXT,
    "secondaryKeywords" TEXT[],
    "searchIntent" TEXT,
    "targetAudience" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "headingPlan" TEXT,
    "internalLinks" TEXT[],
    "externalLinks" TEXT[],
    "sources" TEXT[],
    "schemaType" TEXT,
    "canonicalUrl" TEXT,
    "indexStatus" TEXT,
    "geoTargetQuestions" TEXT[],
    "geoTargetAiQueries" TEXT[],
    "geoDirectAnswer" TEXT,
    "geoFaq" TEXT,
    "geoSourceCredibility" TEXT,
    "geoBrandUsage" TEXT,
    "geoStructuredDataNotes" TEXT,
    "geoQuotableBlocks" TEXT,
    "geoFreshnessDate" TIMESTAMP(3),
    "geoExpertReviewed" BOOLEAN NOT NULL DEFAULT false,
    "geoTrustedSources" TEXT[],
    "wordCount" INTEGER,
    "readingTimeMinutes" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "editorId" TEXT,
    "seoReviewedById" TEXT,
    "approvedById" TEXT,
    "internalNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_works" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "brandId" TEXT,
    "workType" "SeoWorkType" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "targetPage" TEXT,
    "targetUrl" TEXT,
    "description" TEXT,
    "findings" TEXT,
    "actionsTaken" TEXT,
    "keywords" TEXT[],
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "approvedById" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_works" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "brandId" TEXT,
    "workType" "WebsiteWorkType" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "pageName" TEXT,
    "pageUrl" TEXT,
    "oldContent" TEXT,
    "newContent" TEXT,
    "changeDescription" TEXT,
    "changeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_work_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DailyWorkReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "managerNote" TEXT,
    "employeeNote" TEXT,
    "revisionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_work_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_work_items" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "brandId" TEXT,
    "category" "WorkCategory" NOT NULL,
    "platform" "SocialPlatform",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "usedText" TEXT,
    "hashtags" TEXT[],
    "keywords" TEXT[],
    "postUrl" TEXT,
    "siteUrl" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "relatedTaskId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comments" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "socialContentId" TEXT,
    "blogContentId" TEXT,
    "seoWorkId" TEXT,
    "websiteWorkId" TEXT,
    "dailyWorkReportId" TEXT,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comment_mentions" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "content_comment_mentions_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "content_mentions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialContentId" TEXT,
    "blogContentId" TEXT,
    "seoWorkId" TEXT,
    "websiteWorkId" TEXT,
    "dailyWorkItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "socialContentId" TEXT,
    "blogContentId" TEXT,
    "seoWorkId" TEXT,
    "websiteWorkId" TEXT,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ContentRevisionStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "role" "ContentAssetRole" NOT NULL DEFAULT 'OTHER',
    "socialContentId" TEXT,
    "blogContentId" TEXT,
    "seoWorkId" TEXT,
    "websiteWorkId" TEXT,
    "dailyWorkItemId" TEXT,
    "contentCommentId" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "AiActionType" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "decision" "AiOutputDecision" NOT NULL DEFAULT 'PENDING',
    "editedOutput" TEXT,
    "socialContentId" TEXT,
    "blogContentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_token_key" ON "team_invites"("token");

-- CreateIndex
CREATE INDEX "task_columns_projectId_order_idx" ON "task_columns"("projectId", "order");

-- CreateIndex
CREATE INDEX "tasks_projectId_columnId_idx" ON "tasks"("projectId", "columnId");

-- CreateIndex
CREATE INDEX "tasks_projectId_scheduledDate_idx" ON "tasks"("projectId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_recurringTemplateId_scheduledDate_key" ON "tasks"("recurringTemplateId", "scheduledDate");

-- CreateIndex
CREATE INDEX "recurring_task_templates_projectId_active_idx" ON "recurring_task_templates"("projectId", "active");

-- CreateIndex
CREATE INDEX "activity_logs_teamId_createdAt_idx" ON "activity_logs"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_module_createdAt_idx" ON "activity_logs"("module", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "universities_slug_key" ON "universities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "daily_user_stats_date_key" ON "daily_user_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_types_slug_key" ON "announcement_types"("slug");

-- CreateIndex
CREATE INDEX "announcements_universityId_createdAt_idx" ON "announcements"("universityId", "createdAt");

-- CreateIndex
CREATE INDEX "announcements_entryDate_idx" ON "announcements"("entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "important_date_types_slug_key" ON "important_date_types"("slug");

-- CreateIndex
CREATE INDEX "important_dates_universityId_createdAt_idx" ON "important_dates"("universityId", "createdAt");

-- CreateIndex
CREATE INDEX "important_dates_entryDate_idx" ON "important_dates"("entryDate");

-- CreateIndex
CREATE INDEX "important_dates_date_idx" ON "important_dates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "institutes_slug_key" ON "institutes"("slug");

-- CreateIndex
CREATE INDEX "atlas_programs_entryDate_idx" ON "atlas_programs"("entryDate");

-- CreateIndex
CREATE INDEX "atlas_programs_updatedAt_idx" ON "atlas_programs"("updatedAt");

-- CreateIndex
CREATE INDEX "atlas_change_logs_programId_changedAt_idx" ON "atlas_change_logs"("programId", "changedAt");

-- CreateIndex
CREATE INDEX "file_uploads_universityId_createdAt_idx" ON "file_uploads"("universityId", "createdAt");

-- CreateIndex
CREATE INDEX "daily_flow_entries_date_idx" ON "daily_flow_entries"("date");

-- CreateIndex
CREATE INDEX "daily_flow_entries_userId_date_idx" ON "daily_flow_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_flow_entries_userId_date_key" ON "daily_flow_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "daily_flow_breaks_entryId_idx" ON "daily_flow_breaks"("entryId");

-- CreateIndex
CREATE INDEX "daily_flow_edits_entryId_createdAt_idx" ON "daily_flow_edits"("entryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_flow_user_settings_userId_key" ON "daily_flow_user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_flow_team_settings_teamId_key" ON "daily_flow_team_settings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_flow_notification_preferences_userId_key" ON "daily_flow_notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_slug_key" ON "document_types"("slug");

-- CreateIndex
CREATE INDEX "document_folders_parentFolderId_idx" ON "document_folders"("parentFolderId");

-- CreateIndex
CREATE INDEX "document_folders_teamId_idx" ON "document_folders"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_publicShareToken_key" ON "documents"("publicShareToken");

-- CreateIndex
CREATE INDEX "documents_folderId_idx" ON "documents"("folderId");

-- CreateIndex
CREATE INDEX "documents_teamId_idx" ON "documents"("teamId");

-- CreateIndex
CREATE INDEX "documents_ownerId_idx" ON "documents"("ownerId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

-- CreateIndex
CREATE INDEX "documents_isTemplate_idx" ON "documents"("isTemplate");

-- CreateIndex
CREATE INDEX "spreadsheet_ops_documentId_createdAt_idx" ON "spreadsheet_ops"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "document_permissions_documentId_idx" ON "document_permissions"("documentId");

-- CreateIndex
CREATE INDEX "document_permissions_folderId_idx" ON "document_permissions"("folderId");

-- CreateIndex
CREATE INDEX "document_permissions_subjectUserId_idx" ON "document_permissions"("subjectUserId");

-- CreateIndex
CREATE INDEX "document_comments_documentId_resolved_idx" ON "document_comments"("documentId", "resolved");

-- CreateIndex
CREATE INDEX "document_comments_parentCommentId_idx" ON "document_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "document_suggestions_documentId_status_idx" ON "document_suggestions"("documentId", "status");

-- CreateIndex
CREATE INDEX "document_versions_documentId_createdAt_idx" ON "document_versions"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "approval_requests_documentId_status_idx" ON "approval_requests"("documentId", "status");

-- CreateIndex
CREATE INDEX "document_audit_logs_documentId_createdAt_idx" ON "document_audit_logs"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "document_audit_logs_actorId_createdAt_idx" ON "document_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_notification_preferences_userId_key" ON "document_notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "finance_currencies_code_key" ON "finance_currencies"("code");

-- CreateIndex
CREATE INDEX "finance_exchange_rates_currencyId_createdAt_idx" ON "finance_exchange_rates"("currencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_categories_slug_key" ON "finance_categories"("slug");

-- CreateIndex
CREATE INDEX "finance_categories_type_isActive_idx" ON "finance_categories"("type", "isActive");

-- CreateIndex
CREATE INDEX "finance_categories_parentCategoryId_idx" ON "finance_categories"("parentCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_permissions_userId_key" ON "finance_permissions"("userId");

-- CreateIndex
CREATE INDEX "finance_recurring_templates_active_nextOccurrenceDate_idx" ON "finance_recurring_templates"("active", "nextOccurrenceDate");

-- CreateIndex
CREATE INDEX "finance_transactions_type_transactionDate_idx" ON "finance_transactions"("type", "transactionDate");

-- CreateIndex
CREATE INDEX "finance_transactions_personId_idx" ON "finance_transactions"("personId");

-- CreateIndex
CREATE INDEX "finance_transactions_categoryId_idx" ON "finance_transactions"("categoryId");

-- CreateIndex
CREATE INDEX "finance_transactions_status_idx" ON "finance_transactions"("status");

-- CreateIndex
CREATE INDEX "finance_transactions_visibility_idx" ON "finance_transactions"("visibility");

-- CreateIndex
CREATE INDEX "finance_transactions_deletedAt_idx" ON "finance_transactions"("deletedAt");

-- CreateIndex
CREATE INDEX "finance_change_logs_transactionId_changedAt_idx" ON "finance_change_logs"("transactionId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_brands_slug_key" ON "content_brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_permissions_userId_key" ON "content_permissions"("userId");

-- CreateIndex
CREATE INDEX "social_contents_teamId_status_idx" ON "social_contents"("teamId", "status");

-- CreateIndex
CREATE INDEX "social_contents_platform_scheduledAt_idx" ON "social_contents"("platform", "scheduledAt");

-- CreateIndex
CREATE INDEX "social_contents_brandId_idx" ON "social_contents"("brandId");

-- CreateIndex
CREATE INDEX "social_contents_deletedAt_idx" ON "social_contents"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_content_performance_socialContentId_key" ON "social_content_performance"("socialContentId");

-- CreateIndex
CREATE INDEX "blog_contents_teamId_status_idx" ON "blog_contents"("teamId", "status");

-- CreateIndex
CREATE INDEX "blog_contents_brandId_idx" ON "blog_contents"("brandId");

-- CreateIndex
CREATE INDEX "blog_contents_deletedAt_idx" ON "blog_contents"("deletedAt");

-- CreateIndex
CREATE INDEX "seo_works_teamId_status_idx" ON "seo_works"("teamId", "status");

-- CreateIndex
CREATE INDEX "seo_works_brandId_idx" ON "seo_works"("brandId");

-- CreateIndex
CREATE INDEX "seo_works_deletedAt_idx" ON "seo_works"("deletedAt");

-- CreateIndex
CREATE INDEX "website_works_teamId_status_idx" ON "website_works"("teamId", "status");

-- CreateIndex
CREATE INDEX "website_works_brandId_idx" ON "website_works"("brandId");

-- CreateIndex
CREATE INDEX "website_works_deletedAt_idx" ON "website_works"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_work_reports_userId_date_key" ON "daily_work_reports"("userId", "date");

-- CreateIndex
CREATE INDEX "daily_work_items_reportId_idx" ON "daily_work_items"("reportId");

-- CreateIndex
CREATE INDEX "content_assets_fileUploadId_idx" ON "content_assets"("fileUploadId");

-- CreateIndex
CREATE INDEX "ai_generations_userId_createdAt_idx" ON "ai_generations"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_columns" ADD CONSTRAINT "task_columns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "task_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceDocumentCommentId_fkey" FOREIGN KEY ("sourceDocumentCommentId") REFERENCES "document_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "task_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_templates" ADD CONSTRAINT "recurring_task_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_template_assignees" ADD CONSTRAINT "recurring_template_assignees_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_template_assignees" ADD CONSTRAINT "recurring_template_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_user_stats" ADD CONSTRAINT "daily_user_stats_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "announcement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_mentions" ADD CONSTRAINT "announcement_mentions_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_mentions" ADD CONSTRAINT "announcement_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_tags" ADD CONSTRAINT "announcement_tags_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_tags" ADD CONSTRAINT "announcement_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "important_date_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_dates" ADD CONSTRAINT "important_dates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_date_tags" ADD CONSTRAINT "important_date_tags_importantDateId_fkey" FOREIGN KEY ("importantDateId") REFERENCES "important_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_date_tags" ADD CONSTRAINT "important_date_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_date_mentions" ADD CONSTRAINT "important_date_mentions_importantDateId_fkey" FOREIGN KEY ("importantDateId") REFERENCES "important_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "important_date_mentions" ADD CONSTRAINT "important_date_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_programs" ADD CONSTRAINT "atlas_programs_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_programs" ADD CONSTRAINT "atlas_programs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_program_tags" ADD CONSTRAINT "atlas_program_tags_atlasProgramId_fkey" FOREIGN KEY ("atlasProgramId") REFERENCES "atlas_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_program_tags" ADD CONSTRAINT "atlas_program_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_program_mentions" ADD CONSTRAINT "atlas_program_mentions_atlasProgramId_fkey" FOREIGN KEY ("atlasProgramId") REFERENCES "atlas_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_program_mentions" ADD CONSTRAINT "atlas_program_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_change_logs" ADD CONSTRAINT "atlas_change_logs_programId_fkey" FOREIGN KEY ("programId") REFERENCES "atlas_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_change_logs" ADD CONSTRAINT "atlas_change_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_mentions" ADD CONSTRAINT "file_mentions_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "file_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_mentions" ADD CONSTRAINT "file_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_entries" ADD CONSTRAINT "daily_flow_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_entries" ADD CONSTRAINT "daily_flow_entries_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_breaks" ADD CONSTRAINT "daily_flow_breaks_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "daily_flow_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_edits" ADD CONSTRAINT "daily_flow_edits_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "daily_flow_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_edits" ADD CONSTRAINT "daily_flow_edits_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_user_settings" ADD CONSTRAINT "daily_flow_user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_user_settings" ADD CONSTRAINT "daily_flow_user_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_team_settings" ADD CONSTRAINT "daily_flow_team_settings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_team_settings" ADD CONSTRAINT "daily_flow_team_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_flow_notification_preferences" ADD CONSTRAINT "daily_flow_notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spreadsheet_ops" ADD CONSTRAINT "spreadsheet_ops_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spreadsheet_ops" ADD CONSTRAINT "spreadsheet_ops_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_subjectTeamId_fkey" FOREIGN KEY ("subjectTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favorites" ADD CONSTRAINT "document_favorites_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_favorites" ADD CONSTRAINT "document_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_followers" ADD CONSTRAINT "document_followers_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_followers" ADD CONSTRAINT "document_followers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "document_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_currentApproverId_fkey" FOREIGN KEY ("currentApproverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_yjs_states" ADD CONSTRAINT "document_yjs_states_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_notification_preferences" ADD CONSTRAINT "document_notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_exchange_rates" ADD CONSTRAINT "finance_exchange_rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "finance_currencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_exchange_rates" ADD CONSTRAINT "finance_exchange_rates_setById_fkey" FOREIGN KEY ("setById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "finance_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_permissions" ADD CONSTRAINT "finance_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_permissions" ADD CONSTRAINT "finance_permissions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_recurring_templates" ADD CONSTRAINT "finance_recurring_templates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "finance_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_recurring_templates" ADD CONSTRAINT "finance_recurring_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_recurring_templates" ADD CONSTRAINT "finance_recurring_templates_personId_fkey" FOREIGN KEY ("personId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_recurring_templates" ADD CONSTRAINT "finance_recurring_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_recurring_templates" ADD CONSTRAINT "finance_recurring_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "finance_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_personId_fkey" FOREIGN KEY ("personId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "finance_recurring_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_record_visible_users" ADD CONSTRAINT "finance_record_visible_users_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_record_visible_users" ADD CONSTRAINT "finance_record_visible_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_attachments" ADD CONSTRAINT "finance_attachments_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_attachments" ADD CONSTRAINT "finance_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transaction_tags" ADD CONSTRAINT "finance_transaction_tags_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transaction_tags" ADD CONSTRAINT "finance_transaction_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_change_logs" ADD CONSTRAINT "finance_change_logs_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_change_logs" ADD CONSTRAINT "finance_change_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_permissions" ADD CONSTRAINT "content_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_permissions" ADD CONSTRAINT "content_permissions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "content_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_videoEditorId_fkey" FOREIGN KEY ("videoEditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_contents" ADD CONSTRAINT "social_contents_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_content_performance" ADD CONSTRAINT "social_content_performance_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_content_performance" ADD CONSTRAINT "social_content_performance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_contents" ADD CONSTRAINT "blog_contents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_contents" ADD CONSTRAINT "blog_contents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "content_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_contents" ADD CONSTRAINT "blog_contents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_contents" ADD CONSTRAINT "blog_contents_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_contents" ADD CONSTRAINT "blog_contents_seoReviewedById_fkey" FOREIGN KEY ("seoReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_contents" ADD CONSTRAINT "blog_contents_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_works" ADD CONSTRAINT "seo_works_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_works" ADD CONSTRAINT "seo_works_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "content_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_works" ADD CONSTRAINT "seo_works_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_works" ADD CONSTRAINT "seo_works_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_works" ADD CONSTRAINT "seo_works_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_works" ADD CONSTRAINT "website_works_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_works" ADD CONSTRAINT "website_works_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "content_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_works" ADD CONSTRAINT "website_works_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_works" ADD CONSTRAINT "website_works_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_works" ADD CONSTRAINT "website_works_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_reports" ADD CONSTRAINT "daily_work_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_reports" ADD CONSTRAINT "daily_work_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_items" ADD CONSTRAINT "daily_work_items_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_items" ADD CONSTRAINT "daily_work_items_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "content_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_work_items" ADD CONSTRAINT "daily_work_items_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_blogContentId_fkey" FOREIGN KEY ("blogContentId") REFERENCES "blog_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_seoWorkId_fkey" FOREIGN KEY ("seoWorkId") REFERENCES "seo_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_websiteWorkId_fkey" FOREIGN KEY ("websiteWorkId") REFERENCES "website_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_dailyWorkReportId_fkey" FOREIGN KEY ("dailyWorkReportId") REFERENCES "daily_work_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment_mentions" ADD CONSTRAINT "content_comment_mentions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment_mentions" ADD CONSTRAINT "content_comment_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mentions" ADD CONSTRAINT "content_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mentions" ADD CONSTRAINT "content_mentions_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mentions" ADD CONSTRAINT "content_mentions_blogContentId_fkey" FOREIGN KEY ("blogContentId") REFERENCES "blog_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mentions" ADD CONSTRAINT "content_mentions_seoWorkId_fkey" FOREIGN KEY ("seoWorkId") REFERENCES "seo_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mentions" ADD CONSTRAINT "content_mentions_websiteWorkId_fkey" FOREIGN KEY ("websiteWorkId") REFERENCES "website_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_mentions" ADD CONSTRAINT "content_mentions_dailyWorkItemId_fkey" FOREIGN KEY ("dailyWorkItemId") REFERENCES "daily_work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_blogContentId_fkey" FOREIGN KEY ("blogContentId") REFERENCES "blog_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_seoWorkId_fkey" FOREIGN KEY ("seoWorkId") REFERENCES "seo_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_websiteWorkId_fkey" FOREIGN KEY ("websiteWorkId") REFERENCES "website_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "file_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "social_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_blogContentId_fkey" FOREIGN KEY ("blogContentId") REFERENCES "blog_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_seoWorkId_fkey" FOREIGN KEY ("seoWorkId") REFERENCES "seo_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_websiteWorkId_fkey" FOREIGN KEY ("websiteWorkId") REFERENCES "website_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_dailyWorkItemId_fkey" FOREIGN KEY ("dailyWorkItemId") REFERENCES "daily_work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_contentCommentId_fkey" FOREIGN KEY ("contentCommentId") REFERENCES "content_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "social_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_blogContentId_fkey" FOREIGN KEY ("blogContentId") REFERENCES "blog_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
