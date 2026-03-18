"use server";

import webpush from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { openDb, initDb } from "../lib/db";
import { ensureVapidKeys, getVapidSubject } from "../lib/push-config";
import { getSession } from "../lib/session";

let isWebPushConfigured = false;

async function ensureWebPushConfigured() {
  if (isWebPushConfigured) return;

  await initDb();
  const db = await openDb();
  const keys = await ensureVapidKeys(db);
  const subject = await getVapidSubject(db);

  if (!subject) {
    throw new Error(
      "Missing VAPID subject. Set VAPID Subject in Settings before sending notifications.",
    );
  }

  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  isWebPushConfigured = true;
}

export async function subscribeUser(sub: WebPushSubscription) {
  const session = await getSession();
  if (!session?.isLoggedIn || !session.username) {
    throw new Error("Unauthorized");
  }

  if (!sub?.endpoint) {
    throw new Error("Invalid push subscription payload");
  }

  await initDb();
  const db = await openDb();

  await db.run(
    `INSERT INTO push_subscriptions (username, endpoint, subscription_json)
     VALUES (?, ?, ?)
     ON CONFLICT(username, endpoint)
     DO UPDATE SET
       subscription_json = excluded.subscription_json,
       updated_at = CURRENT_TIMESTAMP`,
    [session.username, sub.endpoint, JSON.stringify(sub)],
  );

  return { success: true };
}

export async function unsubscribeUser(endpoint?: string) {
  const session = await getSession();
  if (!session?.isLoggedIn || !session.username) {
    throw new Error("Unauthorized");
  }

  await initDb();
  const db = await openDb();

  if (endpoint) {
    await db.run(
      "DELETE FROM push_subscriptions WHERE username = ? AND endpoint = ?",
      [session.username, endpoint],
    );
  } else {
    await db.run("DELETE FROM push_subscriptions WHERE username = ?", [
      session.username,
    ]);
  }

  return { success: true };
}

export async function sendNotification(message: string) {
  const session = await getSession();
  if (!session?.isLoggedIn || !session.username) {
    throw new Error("Unauthorized");
  }

  try {
    await ensureWebPushConfigured();

    await initDb();
    const db = await openDb();
    const rows = await db.all<
      { endpoint: string; subscription_json: string }[]
    >(
      "SELECT endpoint, subscription_json FROM push_subscriptions WHERE username = ?",
      [session.username],
    );

    if (!rows.length) {
      throw new Error("No subscription available");
    }

    let sentCount = 0;

    for (const row of rows) {
      try {
        const subscription = JSON.parse(
          row.subscription_json,
        ) as WebPushSubscription;

        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: "Test Notification",
            body: message,
            icon: "/icon.png",
          }),
        );
        sentCount++;
      } catch (sendError: unknown) {
        const statusCode =
          typeof sendError === "object" &&
          sendError !== null &&
          "statusCode" in sendError
            ? (sendError as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await db.run(
            "DELETE FROM push_subscriptions WHERE username = ? AND endpoint = ?",
            [session.username, row.endpoint],
          );
          continue;
        }
        throw sendError;
      }
    }

    if (sentCount === 0) {
      throw new Error("No valid subscriptions available");
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send notification",
    };
  }
}
