import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const aiProviderValidator = v.union(
  v.literal("openai"),
  v.literal("kimi"),
  v.literal("openrouter"),
);
const asyncRunProviderValidator = v.union(
  v.literal("cloudflare-queue"),
  v.literal("cloudflare-workflow"),
  v.literal("cloudflare-schedule"),
);
const asyncRunKindValidator = v.union(
  v.literal("job"),
  v.literal("workflow"),
  v.literal("schedule"),
);
const asyncRunStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("delayed"),
  v.literal("canceled"),
  v.literal("unknown"),
);

export default defineSchema({
  ...authTables,
  appUsers: defineTable({
    authUserId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    locale: v.optional(v.string()),
    weekStartsOnMonday: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
    timezoneAutoSync: v.optional(v.boolean()),
    timeFormat: v.optional(v.number()),
    dateFormat: v.optional(v.string()),
    aiProvider: v.optional(aiProviderValidator),
    currentTeamId: v.optional(v.union(v.id("teams"), v.null())),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_email", ["email"]),
  teams: defineTable({
    publicTeamId: v.optional(v.string()),
    name: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    inboxId: v.optional(v.string()),
    email: v.optional(v.string()),
    baseCurrency: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    fiscalYearStartMonth: v.optional(v.number()),
    exportSettings: v.optional(v.any()),
    createdAt: v.string(),
    canceledAt: v.optional(v.string()),
    plan: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    stripeAccountId: v.optional(v.string()),
    stripeConnectStatus: v.optional(v.string()),
    companyType: v.optional(v.string()),
    heardAbout: v.optional(v.string()),
    nextInvoiceSequence: v.optional(v.number()),
    updatedAt: v.string(),
  })
    .index("by_public_team_id", ["publicTeamId"])
    .index("by_inbox_id", ["inboxId"])
    .index("by_stripe_account_id", ["stripeAccountId"]),
  teamMembers: defineTable({
    teamId: v.id("teams"),
    appUserId: v.id("appUsers"),
    role: v.union(v.literal("owner"), v.literal("member")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_id", ["teamId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_team_and_user", ["teamId", "appUserId"]),
  accountingSyncRecords: defineTable({
    publicSyncRecordId: v.optional(v.string()),
    transactionId: v.string(),
    teamId: v.id("teams"),
    provider: v.union(v.literal("xero"), v.literal("quickbooks"), v.literal("fortnox")),
    providerTenantId: v.string(),
    providerTransactionId: v.optional(v.string()),
    syncedAttachmentMapping: v.optional(v.any()),
    syncedAt: v.string(),
    syncType: v.optional(v.literal("manual")),
    status: v.union(
      v.literal("synced"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("pending"),
    ),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    providerEntityType: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_public_sync_record_id", ["publicSyncRecordId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_transaction", ["teamId", "transactionId"])
    .index("by_team_provider_status", ["teamId", "provider", "status"])
    .index("by_team_provider_transaction", ["teamId", "provider", "transactionId"]),
  teamInvites: defineTable({
    publicInviteId: v.optional(v.string()),
    teamId: v.id("teams"),
    email: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("member")),
    code: v.optional(v.string()),
    invitedByAppUserId: v.optional(v.id("appUsers")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_invite_id", ["publicInviteId"])
    .index("by_team_id", ["teamId"])
    .index("by_email", ["email"]),
  apiKeys: defineTable({
    publicApiKeyId: v.optional(v.string()),
    name: v.string(),
    keyEncrypted: v.string(),
    keyHash: v.optional(v.string()),
    scopes: v.array(v.string()),
    teamId: v.id("teams"),
    appUserId: v.id("appUsers"),
    createdAt: v.string(),
    lastUsedAt: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_public_api_key_id", ["publicApiKeyId"])
    .index("by_team_id", ["teamId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_key_hash", ["keyHash"]),
  oauthApplications: defineTable({
    publicApplicationId: v.optional(v.string()),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    overview: v.optional(v.string()),
    developerName: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    installUrl: v.optional(v.string()),
    screenshots: v.array(v.string()),
    redirectUris: v.array(v.string()),
    clientId: v.string(),
    clientSecret: v.string(),
    scopes: v.array(v.string()),
    teamId: v.id("teams"),
    createdByAppUserId: v.id("appUsers"),
    createdAt: v.string(),
    updatedAt: v.string(),
    isPublic: v.boolean(),
    active: v.boolean(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  })
    .index("by_public_application_id", ["publicApplicationId"])
    .index("by_team_id", ["teamId"])
    .index("by_client_id", ["clientId"])
    .index("by_slug", ["slug"]),
  oauthAuthorizationCodes: defineTable({
    publicAuthorizationCodeId: v.optional(v.string()),
    applicationId: v.id("oauthApplications"),
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    code: v.string(),
    scopes: v.array(v.string()),
    redirectUri: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
    used: v.boolean(),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_public_authorization_code_id", ["publicAuthorizationCodeId"])
    .index("by_application_id", ["applicationId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_team_id", ["teamId"])
    .index("by_code", ["code"]),
  oauthAccessTokens: defineTable({
    publicAccessTokenId: v.optional(v.string()),
    applicationId: v.id("oauthApplications"),
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    token: v.string(),
    refreshToken: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.string(),
    refreshTokenExpiresAt: v.optional(v.string()),
    createdAt: v.string(),
    lastUsedAt: v.optional(v.string()),
    revoked: v.boolean(),
    revokedAt: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_public_access_token_id", ["publicAccessTokenId"])
    .index("by_application_id", ["applicationId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_team_id", ["teamId"])
    .index("by_token", ["token"])
    .index("by_refresh_token", ["refreshToken"]),
  installedApps: defineTable({
    publicAppRecordId: v.optional(v.string()),
    teamId: v.id("teams"),
    createdByAppUserId: v.optional(v.id("appUsers")),
    appId: v.string(),
    config: v.optional(v.any()),
    settings: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_app_record_id", ["publicAppRecordId"])
    .index("by_team_id", ["teamId"])
    .index("by_created_by_app_user_id", ["createdByAppUserId"])
    .index("by_app_id", ["appId"])
    .index("by_team_and_app_id", ["teamId", "appId"]),
  activities: defineTable({
    publicActivityId: v.optional(v.string()),
    teamId: v.id("teams"),
    appUserId: v.optional(v.id("appUsers")),
    type: v.string(),
    priority: v.number(),
    groupId: v.optional(v.string()),
    source: v.string(),
    metadata: v.any(),
    status: v.string(),
    createdAt: v.string(),
    lastUsedAt: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index("by_public_activity_id", ["publicActivityId"])
    .index("by_team_id", ["teamId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_status", ["status"]),
  asyncRuns: defineTable({
    publicRunId: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    appUserId: v.optional(v.id("appUsers")),
    provider: asyncRunProviderValidator,
    kind: asyncRunKindValidator,
    providerRunId: v.optional(v.string()),
    providerQueueName: v.optional(v.string()),
    providerJobName: v.optional(v.string()),
    status: asyncRunStatusValidator,
    progress: v.optional(v.number()),
    progressStep: v.optional(v.string()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    canceledAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_run_id", ["publicRunId"])
    .index("by_team_id", ["teamId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_team_status", ["teamId", "status"])
    .index("by_provider_run", ["provider", "providerRunId"]),
  notificationSettings: defineTable({
    publicNotificationSettingId: v.optional(v.string()),
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    notificationType: v.string(),
    channel: v.string(),
    enabled: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_notification_setting_id", ["publicNotificationSettingId"])
    .index("by_app_user_and_team", ["appUserId", "teamId"])
    .index("by_type_and_channel", ["notificationType", "channel"]),
  widgetPreferences: defineTable({
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    primaryWidgets: v.array(v.string()),
    availableWidgets: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_app_user_and_team", ["appUserId", "teamId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_team_id", ["teamId"]),
  suggestedActionUsage: defineTable({
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    actionId: v.string(),
    count: v.number(),
    lastUsedAt: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_app_user_and_team", ["appUserId", "teamId"])
    .index("by_app_user_team_action", ["appUserId", "teamId", "actionId"])
    .index("by_team_id", ["teamId"]),
  chatFeedback: defineTable({
    chatId: v.string(),
    messageId: v.string(),
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    type: v.union(v.literal("positive"), v.literal("negative"), v.literal("other")),
    comment: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_chat_message_user", ["chatId", "messageId", "appUserId"])
    .index("by_chat_id", ["chatId"])
    .index("by_app_user_id", ["appUserId"])
    .index("by_team_id", ["teamId"]),
  aiWorkingMemory: defineTable({
    memoryKey: v.string(),
    scope: v.union(v.literal("chat"), v.literal("user")),
    chatId: v.optional(v.string()),
    userId: v.optional(v.string()),
    content: v.string(),
    updatedAt: v.string(),
  })
    .index("by_memory_key", ["memoryKey"])
    .index("by_scope_chat_user", ["scope", "chatId", "userId"]),
  aiConversationMessages: defineTable({
    chatId: v.string(),
    userId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    timestamp: v.string(),
  }).index("by_chat_id", ["chatId"]),
  aiChatSessions: defineTable({
    chatId: v.string(),
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    messageCount: v.number(),
  })
    .index("by_chat_id", ["chatId"])
    .index("by_user_id", ["userId"]),
  inboxBlocklist: defineTable({
    publicInboxBlocklistId: v.optional(v.string()),
    teamId: v.id("teams"),
    type: v.union(v.literal("email"), v.literal("domain")),
    value: v.string(),
    normalizedValue: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_inbox_blocklist_id", ["publicInboxBlocklistId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_type_value", ["teamId", "type", "normalizedValue"]),
  inboxAccounts: defineTable({
    publicInboxAccountId: v.optional(v.string()),
    teamId: v.id("teams"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    externalId: v.string(),
    expiryDate: v.string(),
    lastAccessed: v.string(),
    scheduleId: v.optional(v.string()),
    status: v.union(v.literal("connected"), v.literal("disconnected")),
    errorMessage: v.optional(v.union(v.string(), v.null())),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_inbox_account_id", ["publicInboxAccountId"])
    .index("by_team_id", ["teamId"])
    .index("by_external_id", ["externalId"])
    .index("by_email", ["email"]),
  inboxItems: defineTable({
    publicInboxId: v.optional(v.string()),
    teamId: v.id("teams"),
    createdAt: v.string(),
    updatedAt: v.string(),
    filePath: v.array(v.string()),
    filePathKey: v.string(),
    fileName: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    attachmentId: v.optional(v.string()),
    date: v.optional(v.string()),
    forwardedTo: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    meta: v.optional(v.any()),
    status: v.union(
      v.literal("new"),
      v.literal("archived"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("pending"),
      v.literal("analyzing"),
      v.literal("suggested_match"),
      v.literal("no_match"),
      v.literal("other"),
      v.literal("deleted"),
    ),
    website: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    displayName: v.optional(v.string()),
    type: v.optional(v.union(v.literal("invoice"), v.literal("expense"), v.literal("other"))),
    description: v.optional(v.string()),
    baseAmount: v.optional(v.number()),
    baseCurrency: v.optional(v.string()),
    taxAmount: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    taxType: v.optional(v.string()),
    inboxAccountId: v.optional(v.string()),
    invoiceNumber: v.optional(v.string()),
    groupedInboxId: v.optional(v.string()),
    searchText: v.optional(v.string()),
    searchEligible: v.optional(v.boolean()),
    searchAmount: v.optional(v.number()),
  })
    .index("by_public_inbox_id", ["publicInboxId"])
    .index("by_team_id", ["teamId"])
    .index("by_reference_id", ["referenceId"])
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_team_and_reference_id", ["teamId", "referenceId"])
    .index("by_team_and_created_at", ["teamId", "createdAt"])
    .index("by_team_and_status", ["teamId", "status"])
    .index("by_team_status_created_at", ["teamId", "status", "createdAt"])
    .index("by_team_and_transaction", ["teamId", "transactionId"])
    .index("by_team_and_inbox_account", ["teamId", "inboxAccountId"])
    .index("by_team_and_invoice_number", ["teamId", "invoiceNumber"])
    .index("by_team_and_grouped_inbox", ["teamId", "groupedInboxId"])
    .index("by_team_and_file_path_key", ["teamId", "filePathKey"])
    .index("by_team_and_date", ["teamId", "date"])
    .index("by_team_search_eligible_amount", ["teamId", "searchEligible", "searchAmount"])
    .searchIndex("search_by_team_and_search_eligible", {
      searchField: "searchText",
      filterFields: ["teamId", "searchEligible"],
    }),
  inboxLiabilityAggregates: defineTable({
    teamId: v.id("teams"),
    date: v.string(),
    currency: v.optional(v.union(v.string(), v.null())),
    totalAmount: v.number(),
    itemCount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_and_date", ["teamId", "date"])
    .index("by_team_date_currency", ["teamId", "date", "currency"]),
  inboxStatusAggregates: defineTable({
    teamId: v.id("teams"),
    status: v.union(
      v.literal("new"),
      v.literal("archived"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("pending"),
      v.literal("analyzing"),
      v.literal("suggested_match"),
      v.literal("no_match"),
      v.literal("other"),
      v.literal("deleted"),
    ),
    createdAtDay: v.string(),
    itemCount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_and_created_at_day", ["teamId", "createdAtDay"])
    .index("by_team_status_created_at_day", ["teamId", "status", "createdAtDay"]),
  transactionMatchSuggestions: defineTable({
    publicSuggestionId: v.optional(v.string()),
    teamId: v.id("teams"),
    inboxId: v.string(),
    transactionId: v.string(),
    normalizedInboxName: v.optional(v.string()),
    normalizedTransactionName: v.optional(v.string()),
    confidenceScore: v.number(),
    amountScore: v.optional(v.number()),
    currencyScore: v.optional(v.number()),
    dateScore: v.optional(v.number()),
    nameScore: v.optional(v.number()),
    matchType: v.union(
      v.literal("auto_matched"),
      v.literal("high_confidence"),
      v.literal("suggested"),
    ),
    matchDetails: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("unmatched"),
    ),
    userActionAt: v.optional(v.string()),
    userId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_suggestion_id", ["publicSuggestionId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_inbox", ["teamId", "inboxId"])
    .index("by_team_and_transaction", ["teamId", "transactionId"])
    .index("by_team_status_created_at", ["teamId", "status", "createdAt"])
    .index("by_team_inbox_transaction", ["teamId", "inboxId", "transactionId"]),
  shortLinks: defineTable({
    publicShortLinkId: v.optional(v.string()),
    shortId: v.string(),
    url: v.string(),
    type: v.optional(v.union(v.literal("redirect"), v.literal("download"))),
    size: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    fileName: v.optional(v.string()),
    teamId: v.id("teams"),
    appUserId: v.id("appUsers"),
    expiresAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_short_link_id", ["publicShortLinkId"])
    .index("by_short_id", ["shortId"])
    .index("by_team_id", ["teamId"])
    .index("by_app_user_id", ["appUserId"]),
  exchangeRates: defineTable({
    base: v.string(),
    target: v.string(),
    rate: v.number(),
    updatedAt: v.string(),
  })
    .index("by_target", ["target"])
    .index("by_base_target", ["base", "target"]),
  institutions: defineTable({
    institutionId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    logo: v.optional(v.string()),
    provider: v.union(v.literal("gocardless"), v.literal("plaid"), v.literal("teller")),
    countries: v.array(v.string()),
    availableHistory: v.optional(v.union(v.number(), v.null())),
    maximumConsentValidity: v.optional(v.union(v.number(), v.null())),
    popularity: v.number(),
    type: v.optional(v.union(v.string(), v.null())),
    status: v.union(v.literal("active"), v.literal("removed")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_institution_id", ["institutionId"])
    .index("by_status", ["status"])
    .index("by_provider_status", ["provider", "status"]),
  bankConnections: defineTable({
    publicBankConnectionId: v.optional(v.string()),
    teamId: v.id("teams"),
    institutionId: v.string(),
    name: v.string(),
    logoUrl: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    enrollmentId: v.optional(v.string()),
    provider: v.union(v.literal("gocardless"), v.literal("plaid"), v.literal("teller")),
    expiresAt: v.optional(v.string()),
    lastAccessed: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("unknown")),
    errorDetails: v.optional(v.string()),
    errorRetries: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_bank_connection_id", ["publicBankConnectionId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_status", ["teamId", "status"])
    .index("by_team_and_institution_id", ["teamId", "institutionId"])
    .index("by_enrollment_id", ["enrollmentId"])
    .index("by_reference_id", ["referenceId"])
    .index("by_team_and_reference_id", ["teamId", "referenceId"]),
  bankAccounts: defineTable({
    publicBankAccountId: v.optional(v.string()),
    teamId: v.id("teams"),
    createdByAppUserId: v.optional(v.id("appUsers")),
    publicCreatedByUserId: v.optional(v.string()),
    bankConnectionId: v.optional(v.id("bankConnections")),
    publicBankConnectionId: v.optional(v.string()),
    name: v.optional(v.string()),
    currency: v.optional(v.string()),
    enabled: v.boolean(),
    accountId: v.string(),
    balance: v.optional(v.union(v.number(), v.null())),
    manual: v.boolean(),
    type: v.optional(
      v.union(
        v.literal("depository"),
        v.literal("credit"),
        v.literal("other_asset"),
        v.literal("loan"),
        v.literal("other_liability"),
      ),
    ),
    baseCurrency: v.optional(v.string()),
    baseBalance: v.optional(v.union(v.number(), v.null())),
    errorDetails: v.optional(v.string()),
    errorRetries: v.optional(v.union(v.number(), v.null())),
    accountReference: v.optional(v.string()),
    iban: v.optional(v.string()),
    subtype: v.optional(v.string()),
    bic: v.optional(v.string()),
    routingNumber: v.optional(v.string()),
    wireRoutingNumber: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    sortCode: v.optional(v.string()),
    availableBalance: v.optional(v.union(v.number(), v.null())),
    creditLimit: v.optional(v.union(v.number(), v.null())),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_bank_account_id", ["publicBankAccountId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_enabled", ["teamId", "enabled"])
    .index("by_team_manual", ["teamId", "manual"])
    .index("by_team_and_account_id", ["teamId", "accountId"])
    .index("by_bank_connection_id", ["bankConnectionId"])
    .index("by_team_and_bank_connection", ["teamId", "bankConnectionId"]),
  customers: defineTable({
    publicCustomerId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    email: v.string(),
    billingEmail: v.optional(v.string()),
    country: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    note: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    token: v.optional(v.string()),
    contact: v.optional(v.string()),
    status: v.optional(v.string()),
    preferredCurrency: v.optional(v.string()),
    defaultPaymentTerms: v.optional(v.number()),
    isArchived: v.optional(v.boolean()),
    source: v.optional(v.string()),
    externalId: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    companyType: v.optional(v.string()),
    employeeCount: v.optional(v.string()),
    foundedYear: v.optional(v.number()),
    estimatedRevenue: v.optional(v.string()),
    fundingStage: v.optional(v.string()),
    totalFunding: v.optional(v.string()),
    headquartersLocation: v.optional(v.string()),
    timezone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    instagramUrl: v.optional(v.string()),
    facebookUrl: v.optional(v.string()),
    ceoName: v.optional(v.string()),
    financeContact: v.optional(v.string()),
    financeContactEmail: v.optional(v.string()),
    primaryLanguage: v.optional(v.string()),
    fiscalYearEnd: v.optional(v.string()),
    enrichmentStatus: v.optional(v.string()),
    enrichedAt: v.optional(v.string()),
    portalEnabled: v.optional(v.boolean()),
    portalId: v.optional(v.string()),
    searchText: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_customer_id", ["publicCustomerId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_created_at", ["teamId", "createdAt"])
    .index("by_portal_id", ["portalId"])
    .index("by_team_and_enrichment_status", ["teamId", "enrichmentStatus"])
    .searchIndex("search_by_team", {
      searchField: "searchText",
      filterFields: ["teamId"],
    }),
  invoiceProducts: defineTable({
    publicInvoiceProductId: v.optional(v.string()),
    teamId: v.id("teams"),
    createdByAppUserId: v.optional(v.id("appUsers")),
    publicCreatedByUserId: v.optional(v.string()),
    name: v.string(),
    nameKey: v.string(),
    normalizedName: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    price: v.optional(v.union(v.number(), v.null())),
    priceKey: v.string(),
    currency: v.optional(v.union(v.string(), v.null())),
    currencyKey: v.string(),
    unit: v.optional(v.union(v.string(), v.null())),
    taxRate: v.optional(v.union(v.number(), v.null())),
    isActive: v.boolean(),
    usageCount: v.number(),
    lastUsedAt: v.optional(v.union(v.string(), v.null())),
    createdAt: v.string(),
    updatedAt: v.optional(v.union(v.string(), v.null())),
  })
    .index("by_public_invoice_product_id", ["publicInvoiceProductId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_active", ["teamId", "isActive"])
    .index("by_team_name_currency_price", ["teamId", "nameKey", "currencyKey", "priceKey"]),
  invoiceTemplates: defineTable({
    publicInvoiceTemplateId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    isDefault: v.boolean(),
    data: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.optional(v.union(v.string(), v.null())),
  })
    .index("by_public_invoice_template_id", ["publicInvoiceTemplateId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_default", ["teamId", "isDefault"]),
  publicInvoices: defineTable({
    publicInvoiceId: v.optional(v.string()),
    teamId: v.id("teams"),
    token: v.string(),
    status: v.string(),
    paymentIntentId: v.optional(v.string()),
    viewedAt: v.optional(v.string()),
    invoiceNumber: v.optional(v.string()),
    invoiceRecurringId: v.optional(v.string()),
    recurringSequence: v.optional(v.number()),
    customerId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    currency: v.optional(v.string()),
    amount: v.optional(v.number()),
    issueDate: v.optional(v.string()),
    sentAt: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    searchText: v.optional(v.string()),
    payload: v.any(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_invoice_id", ["publicInvoiceId"])
    .index("by_invoice_number", ["invoiceNumber"])
    .index("by_team_id", ["teamId"])
    .index("by_team_created_at", ["teamId", "createdAt"])
    .index("by_team_and_customer", ["teamId", "customerId"])
    .index("by_team_customer_issue_date", ["teamId", "customerId", "issueDate"])
    .index("by_team_issue_date", ["teamId", "issueDate"])
    .index("by_team_sent_at", ["teamId", "sentAt"])
    .index("by_team_and_public_invoice_id", ["teamId", "publicInvoiceId"])
    .index("by_team_and_invoice_number", ["teamId", "invoiceNumber"])
    .index("by_team_and_invoice_recurring_id", ["teamId", "invoiceRecurringId"])
    .index("by_team_invoice_recurring_sequence", [
      "teamId",
      "invoiceRecurringId",
      "recurringSequence",
    ])
    .index("by_team_status", ["teamId", "status"])
    .index("by_team_status_created_at", ["teamId", "status", "createdAt"])
    .index("by_team_status_issue_date", ["teamId", "status", "issueDate"])
    .index("by_team_status_due_date", ["teamId", "status", "dueDate"])
    .index("by_team_status_paid_at", ["teamId", "status", "paidAt"])
    .index("by_payment_intent_id", ["paymentIntentId"])
    .index("by_status", ["status"])
    .index("by_token", ["token"])
    .searchIndex("search_by_team", {
      searchField: "searchText",
      filterFields: ["teamId"],
    }),
  invoiceAggregates: defineTable({
    teamId: v.id("teams"),
    scopeKey: v.string(),
    customerId: v.optional(v.string()),
    status: v.string(),
    currency: v.string(),
    invoiceCount: v.number(),
    totalAmount: v.number(),
    oldestDueDate: v.optional(v.string()),
    latestIssueDate: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_scope", ["teamId", "scopeKey"])
    .index("by_team_scope_status", ["teamId", "scopeKey", "status"])
    .index("by_team_scope_status_currency", ["teamId", "scopeKey", "status", "currency"]),
  invoiceDateAggregates: defineTable({
    teamId: v.id("teams"),
    status: v.string(),
    dateField: v.union(v.literal("issueDate"), v.literal("paidAt")),
    date: v.string(),
    currency: v.string(),
    recurring: v.boolean(),
    invoiceCount: v.number(),
    totalAmount: v.number(),
    validPaymentCount: v.number(),
    onTimeCount: v.number(),
    totalDaysToPay: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_status_date_field_date", ["teamId", "status", "dateField", "date"])
    .index("by_team_status_date_field_currency_recurring_date", [
      "teamId",
      "status",
      "dateField",
      "currency",
      "recurring",
      "date",
    ]),
  invoiceCustomerDateAggregates: defineTable({
    teamId: v.id("teams"),
    customerId: v.string(),
    status: v.string(),
    dateField: v.union(v.literal("createdAt"), v.literal("paidAt")),
    date: v.string(),
    currency: v.string(),
    invoiceCount: v.number(),
    totalAmount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_status_date_field_date", ["teamId", "status", "dateField", "date"])
    .index("by_team_customer_status_date_field_currency_date", [
      "teamId",
      "customerId",
      "status",
      "dateField",
      "currency",
      "date",
    ]),
  invoiceAnalyticsAggregates: defineTable({
    teamId: v.id("teams"),
    dateField: v.union(v.literal("createdAt"), v.literal("sentAt"), v.literal("paidAt")),
    date: v.string(),
    status: v.string(),
    currency: v.string(),
    dueDate: v.union(v.string(), v.null()),
    invoiceCount: v.number(),
    totalAmount: v.number(),
    issueToPaidValidCount: v.number(),
    issueToPaidTotalDays: v.number(),
    sentToPaidValidCount: v.number(),
    sentToPaidTotalDays: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_date_field_date", ["teamId", "dateField", "date"])
    .index("by_team_date_field_status_date", ["teamId", "dateField", "status", "date"]),
  invoiceAgingAggregates: defineTable({
    teamId: v.id("teams"),
    status: v.string(),
    currency: v.string(),
    issueDate: v.union(v.string(), v.null()),
    dueDate: v.union(v.string(), v.null()),
    invoiceCount: v.number(),
    totalAmount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_status", ["teamId", "status"])
    .index("by_team_status_currency_issue_due", [
      "teamId",
      "status",
      "currency",
      "issueDate",
      "dueDate",
    ]),
  invoiceRecurringSeries: defineTable({
    publicInvoiceRecurringId: v.optional(v.string()),
    teamId: v.id("teams"),
    customerId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    status: v.string(),
    nextScheduledAt: v.optional(v.string()),
    upcomingNotificationSentAt: v.optional(v.string()),
    payload: v.any(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_invoice_recurring_id", ["publicInvoiceRecurringId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_public_invoice_recurring_id", ["teamId", "publicInvoiceRecurringId"])
    .index("by_team_status", ["teamId", "status"])
    .index("by_status_and_next_scheduled_at", ["status", "nextScheduledAt"])
    .index("by_team_customer", ["teamId", "customerId"]),
  documents: defineTable({
    publicDocumentId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    metadata: v.optional(v.any()),
    pathTokens: v.array(v.string()),
    parentId: v.optional(v.string()),
    objectId: v.optional(v.string()),
    ownerUserId: v.optional(v.string()),
    ownerAppUserId: v.optional(v.id("appUsers")),
    tag: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    date: v.optional(v.string()),
    language: v.optional(v.string()),
    searchText: v.optional(v.string()),
    processingStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  })
    .index("by_public_document_id", ["publicDocumentId"])
    .index("by_team_id", ["teamId"])
    .index("by_name", ["name"])
    .index("by_team_and_name", ["teamId", "name"])
    .index("by_team_and_created_at", ["teamId", "createdAt"])
    .index("by_team_and_date", ["teamId", "date"])
    .searchIndex("search_by_team", {
      searchField: "searchText",
      filterFields: ["teamId"],
    }),
  documentTagEmbeddings: defineTable({
    slug: v.string(),
    name: v.string(),
    embedding: v.array(v.number()),
    model: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_slug", ["slug"]),
  documentTags: defineTable({
    publicDocumentTagId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    slug: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_document_tag_id", ["publicDocumentTagId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_slug", ["teamId", "slug"]),
  documentTagAssignments: defineTable({
    teamId: v.id("teams"),
    documentId: v.string(),
    tagId: v.string(),
    documentTagId: v.id("documentTags"),
    documentCreatedAt: v.optional(v.string()),
    documentDate: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_id", ["teamId"])
    .index("by_team_and_document", ["teamId", "documentId"])
    .index("by_team_and_tag", ["teamId", "tagId"])
    .index("by_team_document_tag", ["teamId", "documentId", "tagId"])
    .index("by_team_tag_and_document_created_at", [
      "teamId",
      "tagId",
      "documentCreatedAt",
      "documentId",
    ]),
  tags: defineTable({
    publicTagId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_tag_id", ["publicTagId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_name", ["teamId", "name"]),
  transactionTags: defineTable({
    publicTransactionTagId: v.optional(v.string()),
    teamId: v.id("teams"),
    transactionId: v.string(),
    tagId: v.string(),
    transactionDate: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_transaction_tag_id", ["publicTransactionTagId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_transaction", ["teamId", "transactionId"])
    .index("by_team_and_tag", ["teamId", "tagId"])
    .index("by_team_transaction_tag", ["teamId", "transactionId", "tagId"])
    .index("by_team_tag_transaction_date", ["teamId", "tagId", "transactionDate", "transactionId"]),
  transactionAttachments: defineTable({
    publicTransactionAttachmentId: v.optional(v.string()),
    teamId: v.id("teams"),
    transactionId: v.optional(v.string()),
    type: v.string(),
    name: v.string(),
    size: v.number(),
    path: v.array(v.string()),
    pathKey: v.string(),
    createdAt: v.string(),
  })
    .index("by_public_transaction_attachment_id", ["publicTransactionAttachmentId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_transaction", ["teamId", "transactionId"])
    .index("by_team_and_path_key", ["teamId", "pathKey"]),
  transactions: defineTable({
    publicTransactionId: v.optional(v.string()),
    teamId: v.id("teams"),
    createdAt: v.string(),
    updatedAt: v.string(),
    date: v.string(),
    name: v.string(),
    method: v.union(
      v.literal("payment"),
      v.literal("card_purchase"),
      v.literal("card_atm"),
      v.literal("transfer"),
      v.literal("other"),
      v.literal("unknown"),
      v.literal("ach"),
      v.literal("interest"),
      v.literal("deposit"),
      v.literal("wire"),
      v.literal("fee"),
    ),
    amount: v.number(),
    currency: v.string(),
    assignedId: v.optional(v.string()),
    note: v.optional(v.string()),
    bankAccountId: v.optional(v.string()),
    internalId: v.string(),
    status: v.union(
      v.literal("posted"),
      v.literal("pending"),
      v.literal("excluded"),
      v.literal("completed"),
      v.literal("archived"),
      v.literal("exported"),
    ),
    balance: v.optional(v.number()),
    manual: v.boolean(),
    notified: v.optional(v.boolean()),
    internal: v.optional(v.boolean()),
    description: v.optional(v.string()),
    categorySlug: v.optional(v.string()),
    baseAmount: v.optional(v.number()),
    counterpartyName: v.optional(v.string()),
    baseCurrency: v.optional(v.string()),
    taxAmount: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    taxType: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
    frequency: v.optional(
      v.union(
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("semi_monthly"),
        v.literal("annually"),
        v.literal("irregular"),
        v.literal("unknown"),
      ),
    ),
    merchantName: v.optional(v.string()),
    enrichmentCompleted: v.optional(v.boolean()),
    hasAttachment: v.optional(v.boolean()),
    searchText: v.optional(v.string()),
    searchAmount: v.optional(v.number()),
  })
    .index("by_public_transaction_id", ["publicTransactionId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_date", ["teamId", "date"])
    .index("by_team_and_bank_account", ["teamId", "bankAccountId"])
    .index("by_team_bank_account_date", ["teamId", "bankAccountId", "date"])
    .index("by_team_and_enrichment_completed", ["teamId", "enrichmentCompleted"])
    .index("by_team_notified_date", ["teamId", "notified", "date"])
    .index("by_team_and_internal_id", ["teamId", "internalId"])
    .index("by_team_and_search_amount", ["teamId", "searchAmount"])
    .searchIndex("search_by_team", {
      searchField: "searchText",
      filterFields: ["teamId"],
    }),
  transactionMetricAggregates: defineTable({
    teamId: v.id("teams"),
    scope: v.union(v.literal("base"), v.literal("native")),
    date: v.string(),
    currency: v.string(),
    direction: v.union(v.literal("income"), v.literal("expense")),
    categorySlug: v.union(v.string(), v.null()),
    recurring: v.boolean(),
    totalAmount: v.number(),
    totalNetAmount: v.optional(v.number()),
    transactionCount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_scope_currency_date", ["teamId", "scope", "currency", "date"])
    .index("by_team_scope_currency_date_direction_category_recurring", [
      "teamId",
      "scope",
      "currency",
      "date",
      "direction",
      "categorySlug",
      "recurring",
    ]),
  transactionRecurringAggregates: defineTable({
    teamId: v.id("teams"),
    scope: v.union(v.literal("base"), v.literal("native")),
    direction: v.union(v.literal("income"), v.literal("expense")),
    currency: v.string(),
    date: v.string(),
    name: v.string(),
    frequency: v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly"),
      v.literal("semi_monthly"),
      v.literal("annually"),
      v.literal("irregular"),
      v.literal("unknown"),
      v.null(),
    ),
    categorySlug: v.union(v.string(), v.null()),
    totalAmount: v.number(),
    transactionCount: v.number(),
    latestAmount: v.number(),
    latestTransactionCreatedAt: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_scope_direction_currency_date", [
      "teamId",
      "scope",
      "direction",
      "currency",
      "date",
    ])
    .index("by_team_scope_direction_currency_name_frequency_category_date", [
      "teamId",
      "scope",
      "direction",
      "currency",
      "name",
      "frequency",
      "categorySlug",
      "date",
    ]),
  transactionTaxAggregates: defineTable({
    teamId: v.id("teams"),
    scope: v.union(v.literal("base"), v.literal("native")),
    date: v.string(),
    currency: v.string(),
    direction: v.union(v.literal("income"), v.literal("expense")),
    categorySlug: v.union(v.string(), v.null()),
    taxType: v.union(v.string(), v.null()),
    taxRate: v.number(),
    totalTaxAmount: v.number(),
    totalTransactionAmount: v.number(),
    transactionCount: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_scope_direction_currency_date", [
      "teamId",
      "scope",
      "direction",
      "currency",
      "date",
    ])
    .index("by_team_scope_currency_date_direction_category_tax_type_tax_rate", [
      "teamId",
      "scope",
      "currency",
      "date",
      "direction",
      "categorySlug",
      "taxType",
      "taxRate",
    ]),
  trackerProjects: defineTable({
    publicTrackerProjectId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    customerId: v.optional(v.string()),
    estimate: v.optional(v.number()),
    currency: v.optional(v.string()),
    billable: v.optional(v.boolean()),
    rate: v.optional(v.number()),
    searchText: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_tracker_project_id", ["publicTrackerProjectId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_created_at", ["teamId", "createdAt"])
    .index("by_team_and_status", ["teamId", "status"])
    .index("by_team_status_created_at", ["teamId", "status", "createdAt"])
    .index("by_team_and_customer", ["teamId", "customerId"])
    .searchIndex("search_by_team", {
      searchField: "searchText",
      filterFields: ["teamId"],
    }),
  trackerEntries: defineTable({
    publicTrackerEntryId: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.optional(v.string()),
    assignedId: v.optional(v.string()),
    description: v.optional(v.string()),
    start: v.optional(v.string()),
    stop: v.optional(v.string()),
    duration: v.optional(v.number()),
    date: v.string(),
    billed: v.optional(v.boolean()),
    rate: v.optional(v.number()),
    currency: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_tracker_entry_id", ["publicTrackerEntryId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_date", ["teamId", "date"])
    .index("by_team_and_project", ["teamId", "projectId"])
    .index("by_team_and_assigned", ["teamId", "assignedId"])
    .index("by_team_project_date", ["teamId", "projectId", "date"])
    .index("by_team_assigned_date", ["teamId", "assignedId", "date"]),
  trackerProjectTags: defineTable({
    teamId: v.id("teams"),
    trackerProjectId: v.string(),
    tagId: v.string(),
    projectCreatedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_id", ["teamId"])
    .index("by_team_and_project", ["teamId", "trackerProjectId"])
    .index("by_team_and_tag", ["teamId", "tagId"])
    .index("by_team_project_tag", ["teamId", "trackerProjectId", "tagId"])
    .index("by_team_tag_project_created_at", [
      "teamId",
      "tagId",
      "projectCreatedAt",
      "trackerProjectId",
    ]),
  customerTags: defineTable({
    customerId: v.string(),
    tagId: v.string(),
    teamId: v.id("teams"),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_team_customer_tag", ["teamId", "customerId", "tagId"])
    .index("by_team_and_customer", ["teamId", "customerId"])
    .index("by_team_and_tag", ["teamId", "tagId"]),
  transactionCategoryEmbeddings: defineTable({
    name: v.string(),
    embedding: v.array(v.number()),
    model: v.string(),
    system: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_system", ["system"]),
  transactionCategories: defineTable({
    publicTransactionCategoryId: v.optional(v.string()),
    teamId: v.id("teams"),
    name: v.string(),
    color: v.optional(v.string()),
    slug: v.string(),
    description: v.optional(v.string()),
    system: v.boolean(),
    taxRate: v.optional(v.number()),
    taxType: v.optional(v.string()),
    taxReportingCode: v.optional(v.string()),
    excluded: v.optional(v.boolean()),
    parentId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_transaction_category_id", ["publicTransactionCategoryId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_slug", ["teamId", "slug"])
    .index("by_team_and_parent", ["teamId", "parentId"])
    .index("by_team_and_system", ["teamId", "system"]),
  insightUserStatuses: defineTable({
    appUserId: v.id("appUsers"),
    insightId: v.string(),
    readAt: v.optional(v.string()),
    dismissedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_app_user_id", ["appUserId"])
    .index("by_app_user_insight", ["appUserId", "insightId"])
    .index("by_insight_id", ["insightId"]),
  insightRecords: defineTable({
    publicInsightId: v.optional(v.string()),
    teamId: v.id("teams"),
    periodType: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly"),
    ),
    periodStart: v.string(),
    periodEnd: v.string(),
    periodYear: v.number(),
    periodNumber: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    selectedMetrics: v.optional(v.any()),
    allMetrics: v.optional(v.any()),
    anomalies: v.optional(v.any()),
    expenseAnomalies: v.optional(v.any()),
    milestones: v.optional(v.any()),
    activity: v.optional(v.any()),
    currency: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.any()),
    predictions: v.optional(v.any()),
    audioPath: v.optional(v.string()),
    generatedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_insight_id", ["publicInsightId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_period", ["teamId", "periodType", "periodYear", "periodNumber"]),
  reportLinks: defineTable({
    publicReportId: v.optional(v.string()),
    linkId: v.string(),
    teamId: v.id("teams"),
    createdByAppUserId: v.optional(v.id("appUsers")),
    type: v.union(
      v.literal("profit"),
      v.literal("revenue"),
      v.literal("burn_rate"),
      v.literal("expense"),
      v.literal("monthly_revenue"),
      v.literal("revenue_forecast"),
      v.literal("runway"),
      v.literal("category_expenses"),
    ),
    from: v.string(),
    to: v.string(),
    currency: v.optional(v.string()),
    expireAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_report_id", ["publicReportId"])
    .index("by_link_id", ["linkId"])
    .index("by_team_id", ["teamId"])
    .index("by_created_by_app_user_id", ["createdByAppUserId"]),
  evidencePacks: defineTable({
    publicEvidencePackId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    vatReturnId: v.string(),
    checksum: v.string(),
    payload: v.any(),
    createdBy: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_evidence_pack_id", ["publicEvidencePackId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_vat_return_id", ["teamId", "vatReturnId"])
    .index("by_team_and_public_evidence_pack_id", ["teamId", "publicEvidencePackId"]),
  filingSequences: defineTable({
    scope: v.string(),
    nextValue: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_scope", ["scope"]),
  submissionEvents: defineTable({
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    provider: v.string(),
    obligationType: v.string(),
    vatReturnId: v.optional(v.string()),
    status: v.string(),
    eventType: v.string(),
    correlationId: v.optional(v.string()),
    requestPayload: v.optional(v.any()),
    responsePayload: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_team_id", ["teamId"])
    .index("by_team_and_vat_return_id", ["teamId", "vatReturnId"]),
  sourceLinks: defineTable({
    publicSourceLinkId: v.optional(v.string()),
    teamId: v.id("teams"),
    sourceType: v.union(
      v.literal("transaction"),
      v.literal("invoice"),
      v.literal("invoice_refund"),
      v.literal("inbox"),
      v.literal("manual_adjustment"),
      v.literal("payroll_import"),
    ),
    sourceId: v.string(),
    journalEntryId: v.string(),
    meta: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_source_link_id", ["publicSourceLinkId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_source_type", ["teamId", "sourceType"])
    .index("by_team_source_type_source_id", ["teamId", "sourceType", "sourceId"]),
  complianceJournalEntries: defineTable({
    publicJournalEntryId: v.optional(v.string()),
    teamId: v.id("teams"),
    entryDate: v.string(),
    reference: v.optional(v.string()),
    description: v.optional(v.string()),
    sourceType: v.union(
      v.literal("transaction"),
      v.literal("invoice"),
      v.literal("invoice_refund"),
      v.literal("manual_adjustment"),
      v.literal("payroll_import"),
    ),
    sourceId: v.string(),
    currency: v.string(),
    meta: v.optional(v.any()),
    lines: v.array(
      v.object({
        accountCode: v.string(),
        description: v.optional(v.string()),
        debit: v.number(),
        credit: v.number(),
        taxRate: v.optional(v.number()),
        taxAmount: v.optional(v.number()),
        taxType: v.optional(v.string()),
        vatBox: v.optional(v.string()),
        meta: v.optional(v.any()),
      }),
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_journal_entry_id", ["publicJournalEntryId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_entry_date", ["teamId", "entryDate"]),
  complianceAdjustments: defineTable({
    publicComplianceAdjustmentId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    vatReturnId: v.optional(v.string()),
    obligationId: v.optional(v.string()),
    effectiveDate: v.string(),
    lineCode: v.union(
      v.literal("box1"),
      v.literal("box2"),
      v.literal("box3"),
      v.literal("box4"),
      v.literal("box5"),
      v.literal("box6"),
      v.literal("box7"),
      v.literal("box8"),
      v.literal("box9"),
    ),
    amount: v.number(),
    reason: v.string(),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    meta: v.optional(v.any()),
    createdAt: v.string(),
  })
    .index("by_public_compliance_adjustment_id", ["publicComplianceAdjustmentId"])
    .index("by_team_and_filing_profile_id", ["teamId", "filingProfileId"])
    .index("by_team_and_vat_return_id", ["teamId", "vatReturnId"]),
  filingProfiles: defineTable({
    publicFilingProfileId: v.optional(v.string()),
    teamId: v.id("teams"),
    provider: v.string(),
    legalEntityType: v.string(),
    enabled: v.boolean(),
    countryCode: v.string(),
    companyName: v.optional(v.string()),
    companyNumber: v.optional(v.string()),
    companyAuthenticationCode: v.optional(v.string()),
    utr: v.optional(v.string()),
    vrn: v.optional(v.string()),
    vatScheme: v.optional(v.string()),
    accountingBasis: v.string(),
    filingMode: v.string(),
    agentReferenceNumber: v.optional(v.string()),
    yearEndMonth: v.optional(v.number()),
    yearEndDay: v.optional(v.number()),
    baseCurrency: v.optional(v.string()),
    principalActivity: v.optional(v.string()),
    directors: v.optional(v.array(v.string())),
    signingDirectorName: v.optional(v.string()),
    approvalDate: v.optional(v.string()),
    averageEmployeeCount: v.optional(v.number()),
    ordinaryShareCount: v.optional(v.number()),
    ordinaryShareNominalValue: v.optional(v.number()),
    dormant: v.optional(v.boolean()),
    auditExemptionClaimed: v.optional(v.boolean()),
    membersDidNotRequireAudit: v.optional(v.boolean()),
    directorsAcknowledgeResponsibilities: v.optional(v.boolean()),
    accountsPreparedUnderSmallCompaniesRegime: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_filing_profile_id", ["publicFilingProfileId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_provider", ["teamId", "provider"]),
  complianceObligations: defineTable({
    publicComplianceObligationId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    provider: v.string(),
    obligationType: v.string(),
    periodKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    dueDate: v.string(),
    status: v.string(),
    externalId: v.optional(v.string()),
    raw: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_compliance_obligation_id", ["publicComplianceObligationId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_filing_profile_period_key", [
      "teamId",
      "filingProfileId",
      "provider",
      "obligationType",
      "periodKey",
    ]),
  yearEndPacks: defineTable({
    publicYearEndPackId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    periodKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    accountsDueDate: v.string(),
    corporationTaxDueDate: v.string(),
    status: v.union(v.literal("draft"), v.literal("ready"), v.literal("exported")),
    currency: v.string(),
    trialBalance: v.any(),
    profitAndLoss: v.any(),
    balanceSheet: v.any(),
    retainedEarnings: v.any(),
    workingPapers: v.any(),
    corporationTax: v.any(),
    manualJournalCount: v.number(),
    payrollRunCount: v.number(),
    exportBundles: v.array(
      v.object({
        id: v.string(),
        filePath: v.string(),
        fileName: v.string(),
        checksum: v.string(),
        generatedAt: v.string(),
        manifest: v.any(),
      }),
    ),
    latestExportedAt: v.optional(v.string()),
    snapshotChecksum: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_year_end_pack_id", ["publicYearEndPackId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_filing_profile_period_key", ["teamId", "filingProfileId", "periodKey"]),
  corporationTaxAdjustments: defineTable({
    publicCorporationTaxAdjustmentId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    periodKey: v.string(),
    category: v.optional(v.string()),
    label: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_corporation_tax_adjustment_id", ["publicCorporationTaxAdjustmentId"])
    .index("by_team_and_filing_profile_period_key", ["teamId", "filingProfileId", "periodKey"]),
  closeCompanyLoansSchedules: defineTable({
    publicCloseCompanyLoansScheduleId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    periodKey: v.string(),
    beforeEndPeriod: v.boolean(),
    loansMade: v.array(
      v.object({
        name: v.string(),
        amountOfLoan: v.number(),
      }),
    ),
    taxChargeable: v.optional(v.number()),
    reliefEarlierThan: v.array(
      v.object({
        name: v.string(),
        amountRepaid: v.optional(v.number()),
        amountReleasedOrWrittenOff: v.optional(v.number()),
        date: v.string(),
      }),
    ),
    reliefEarlierDue: v.optional(v.number()),
    loanLaterReliefNow: v.array(
      v.object({
        name: v.string(),
        amountRepaid: v.optional(v.number()),
        amountReleasedOrWrittenOff: v.optional(v.number()),
        date: v.string(),
      }),
    ),
    reliefLaterDue: v.optional(v.number()),
    totalLoansOutstanding: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_close_company_loans_schedule_id", ["publicCloseCompanyLoansScheduleId"])
    .index("by_team_and_filing_profile_period_key", ["teamId", "filingProfileId", "periodKey"]),
  corporationTaxRateSchedules: defineTable({
    publicCorporationTaxRateScheduleId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    periodKey: v.string(),
    exemptDistributions: v.optional(v.number()),
    associatedCompaniesThisPeriod: v.optional(v.number()),
    associatedCompaniesFirstYear: v.optional(v.number()),
    associatedCompaniesSecondYear: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_corporation_tax_rate_schedule_id", ["publicCorporationTaxRateScheduleId"])
    .index("by_team_and_filing_profile_period_key", ["teamId", "filingProfileId", "periodKey"]),
  payrollRuns: defineTable({
    publicPayrollRunId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    periodKey: v.string(),
    payPeriodStart: v.string(),
    payPeriodEnd: v.string(),
    runDate: v.string(),
    source: v.union(v.literal("csv"), v.literal("manual")),
    status: v.union(v.literal("imported"), v.literal("exported")),
    importChecksum: v.string(),
    currency: v.string(),
    journalEntryId: v.string(),
    lineCount: v.number(),
    liabilityTotals: v.object({
      grossPay: v.number(),
      employerTaxes: v.number(),
      payeLiability: v.number(),
    }),
    exportBundles: v.array(
      v.object({
        id: v.string(),
        filePath: v.string(),
        fileName: v.string(),
        checksum: v.string(),
        generatedAt: v.string(),
        manifest: v.any(),
      }),
    ),
    latestExportedAt: v.optional(v.string()),
    meta: v.optional(v.any()),
    createdBy: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_payroll_run_id", ["publicPayrollRunId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_period_key", ["teamId", "periodKey"]),
  vatReturns: defineTable({
    publicVatReturnId: v.optional(v.string()),
    teamId: v.id("teams"),
    filingProfileId: v.string(),
    obligationId: v.optional(v.string()),
    periodKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    status: v.string(),
    currency: v.string(),
    netVatDue: v.number(),
    submittedAt: v.optional(v.string()),
    externalSubmissionId: v.optional(v.string()),
    declarationAccepted: v.optional(v.boolean()),
    lines: v.array(
      v.object({
        code: v.string(),
        label: v.string(),
        amount: v.number(),
        meta: v.optional(v.any()),
      }),
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_public_vat_return_id", ["publicVatReturnId"])
    .index("by_team_id", ["teamId"])
    .index("by_team_and_obligation_id", ["teamId", "obligationId"])
    .index("by_team_and_filing_profile_period_key", ["teamId", "filingProfileId", "periodKey"]),
  files: defineTable({
    path: v.string(),
    pathTokens: v.array(v.string()),
    storageId: v.id("_storage"),
    teamId: v.optional(v.string()),
    bucket: v.optional(v.string()),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    uploadedBy: v.optional(v.id("users")),
  }).index("by_path", ["path"]),
});
