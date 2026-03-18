import webpush from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { initDb, openDb } from "@/lib/db";
import { ensureVapidKeys, getVapidSubject } from "@/lib/push-config";

type NotificationEventInput = {
  type?: "automation" | "request" | "system";
  title: string;
  body?: string;
  targetPath?: string;
  usernames?: string[];
};

let isWebPushConfigured = false;

async function ensureWebPushConfigured() {
  if (isWebPushConfigured) return true;

  await initDb();
  const db = await openDb();
  const keys = await ensureVapidKeys(db);
  const subject = await getVapidSubject(db);

  if (!subject) {
    return false;
  }

  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  isWebPushConfigured = true;
  return true;
}

async function resolveUsernames(explicitUsernames?: string[]) {
  const filteredExplicit = (explicitUsernames || []).filter(Boolean);
  if (filteredExplicit.length > 0) {
    return [...new Set(filteredExplicit)];
  }

  const db = await openDb();
  const users = await db.all<{ username: string }[]>(
    "SELECT username FROM users WHERE username IS NOT NULL AND TRIM(username) != ''",
  );

  const fromUsers = users.map((row) => row.username.trim()).filter(Boolean);
  if (fromUsers.length > 0) {
    return [...new Set(fromUsers)];
  }

  const pushUsers = await db.all<{ username: string }[]>(
    "SELECT DISTINCT username FROM push_subscriptions WHERE username IS NOT NULL AND TRIM(username) != ''",
  );

  return [
    ...new Set(pushUsers.map((row) => row.username.trim()).filter(Boolean)),
  ];
}

export async function saveNotificationEvent(input: NotificationEventInput) {
  await initDb();
  const db = await openDb();

  const usernames = await resolveUsernames(input.usernames);
  if (usernames.length === 0) return { success: true, saved: 0 };

  const type = input.type || "system";
  const targetPath =
    input.targetPath && input.targetPath.startsWith("/")
      ? input.targetPath
      : "/";

  await db.exec("BEGIN TRANSACTION");
  try {
    for (const username of usernames) {
      await db.run(
        `INSERT INTO notifications (username, type, title, body, target_path)
         VALUES (?, ?, ?, ?, ?)`,
        [username, type, input.title, input.body || null, targetPath],
      );
    }
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  return { success: true, saved: usernames.length };
}

export async function sendPushNotificationEvent(input: NotificationEventInput) {
  await initDb();
  const db = await openDb();

  const configured = await ensureWebPushConfigured();
  if (!configured) {
    return { success: false, sent: 0, error: "Missing VAPID subject" };
  }

  const usernames = await resolveUsernames(input.usernames);
  if (usernames.length === 0) {
    return { success: true, sent: 0 };
  }

  const placeholders = usernames.map(() => "?").join(",");
  const rows = await db.all<
    { username: string; endpoint: string; subscription_json: string }[]
  >(
    `SELECT username, endpoint, subscription_json
     FROM push_subscriptions
     WHERE username IN (${placeholders})`,
    usernames,
  );

  if (!rows.length) {
    return { success: true, sent: 0 };
  }

  let sent = 0;
  const targetPath =
    input.targetPath && input.targetPath.startsWith("/")
      ? input.targetPath
      : "/";

  for (const row of rows) {
    try {
      const subscription = JSON.parse(
        row.subscription_json,
      ) as WebPushSubscription;

      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: input.title,
          body: input.body || "",
          icon: "/icon.png",
          targetPath,
          type: input.type || "system",
        }),
      );
      sent++;
    } catch (error: unknown) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? ((error as { statusCode?: number }).statusCode as number)
          : undefined;

      if (statusCode === 404 || statusCode === 410) {
        await db.run(
          "DELETE FROM push_subscriptions WHERE username = ? AND endpoint = ?",
          [row.username, row.endpoint],
        );
      }
    }
  }

  return { success: true, sent };
}

export async function notifyUsers(input: NotificationEventInput) {
  await saveNotificationEvent(input);
  const push = await sendPushNotificationEvent(input);
  return {
    success: true,
    pushSent: push.sent || 0,
  };
}
