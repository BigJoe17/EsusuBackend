import { logger } from "./logger";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send a push notification via Expo's push API.
 * This is free and works with the Expo Go app and standalone builds.
 */
export async function sendPushNotification(
  expoPushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!expoPushToken) {
    logger.debug("[PUSH] No push token for user — skipping push notification");
    return;
  }

  if (!expoPushToken.startsWith("ExponentPushToken[")) {
    logger.warn(`[PUSH] Invalid push token format: ${expoPushToken}`);
    return;
  }

  const message: PushMessage = { to: expoPushToken, title, body, data };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json() as any;

    if (result?.data?.status === "error") {
      logger.warn(`[PUSH] Expo push error: ${result.data.message}`);
    } else {
      logger.info(`[PUSH] Notification sent → ${expoPushToken.slice(0, 30)}...`);
    }
  } catch (error) {
    logger.error("[PUSH] Failed to send push notification:", error as Error);
    // Non-blocking — never throw from push notification
  }
}

/**
 * Send push notifications to multiple tokens.
 */
export async function sendPushNotificationBatch(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const validTokens = tokens.filter(
    (t) => t && t.startsWith("ExponentPushToken[")
  );

  if (validTokens.length === 0) return;

  try {
    const messages = validTokens.map((to) => ({ to, title, body, data }));
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json() as any;
    logger.info(`[PUSH] Batch sent to ${validTokens.length} tokens`, { result });
  } catch (error) {
    logger.error("[PUSH] Batch push failed:", error as Error);
  }
}
