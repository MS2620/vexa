import webpush from "web-push";

type DbClient = {
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<unknown>;
};

export const DEFAULT_VAPID_SUBJECT = "mailto:notifications@yourdomain.com";

export async function ensureVapidKeys(db: DbClient) {
  const settings = await db.get<
    { vapid_public_key?: string; vapid_private_key?: string } | undefined
  >("SELECT vapid_public_key, vapid_private_key FROM settings WHERE id = 1");

  const publicKey = settings?.vapid_public_key?.trim();
  const privateKey = settings?.vapid_private_key?.trim();

  if (publicKey && privateKey) {
    return { publicKey, privateKey };
  }

  const generated = webpush.generateVAPIDKeys();
  await db.run(
    `UPDATE settings
     SET vapid_public_key = ?, vapid_private_key = ?
     WHERE id = 1`,
    [generated.publicKey, generated.privateKey],
  );

  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };
}

export async function getVapidSubject(db: DbClient) {
  const settings = await db.get<{ vapid_subject?: string } | undefined>(
    "SELECT vapid_subject FROM settings WHERE id = 1",
  );
  return settings?.vapid_subject?.trim() || DEFAULT_VAPID_SUBJECT;
}
