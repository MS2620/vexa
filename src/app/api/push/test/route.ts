import { NextResponse } from "next/server";
import { sendNotification } from "@/app/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message =
      typeof body?.message === "string" && body.message.trim()
        ? body.message.trim()
        : "This is a test push notification from Vexa.";

    const result = await sendNotification(message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send test notification" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to send test notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
