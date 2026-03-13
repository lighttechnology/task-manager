import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notifyChat } from "@/lib/google/chat";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  try {
    await notifyChat(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Notification failed" },
      { status: 500 }
    );
  }
}
