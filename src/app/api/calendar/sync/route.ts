import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { syncTaskToCalendar } from "@/lib/google/calendar";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.access_token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id } = await req.json();
  const supabase = createServerClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", task_id)
    .single();

  if (error || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const eventId = await syncTaskToCalendar(task, session.access_token);
    if (eventId) {
      await supabase
        .from("tasks")
        .update({ google_calendar_event_id: eventId })
        .eq("id", task_id);
    }
    return NextResponse.json({ event_id: eventId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Calendar sync failed" },
      { status: 500 }
    );
  }
}
