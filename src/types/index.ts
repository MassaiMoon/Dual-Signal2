// Shared request/response types for API routes

export type SimulateEventBody = {
  // Which badge to send the event to
  badgeId: string;
  // Event type (POST_CREATED, REPLY, SHARE, ...)
  eventType: string;
  // Unique ID of the content (prevents double-count on retry)
  contentId: string;
  // Admin secret
  secret: string;
};

export type WebhookTestBody = {
  // Source to simulate
  source: string;
  eventType: string;
  externalUserId: string;
  contentId: string;
  payload?: Record<string, unknown>;
  // Webhook test secret
  secret: string;
};

export type BadgeResponse = {
  id: string;
  dualObjectId: string;
  identityTier: string;
  signalCount: number;
  achievementLevel: string;
  achievements: Array<{ type: string; level: number; progress: number }>;
};

export type ApiError = {
  error: string;
};
