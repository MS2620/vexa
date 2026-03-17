import { openDb } from "./db";

export async function addLog(
  level: "info" | "warn" | "error" | "success",
  message: string,
  context?: any,
) {
  try {
    const db = await openDb();
    await db.run(
      "INSERT INTO logs (level, message, context) VALUES (?, ?, ?)",
      [
        level,
        message,
        context
          ? typeof context === "string"
            ? context
            : JSON.stringify(context)
          : null,
      ],
    );
  } catch (error) {
    console.error("Failed to write to logs table:", error);
  }
}
