import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { notifyChat } from "@/lib/google/chat";

export async function GET(req: NextRequest) {
  // Vercel Cron または手動呼び出し用の認証
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // 今日の日付範囲を計算（JST）
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const todayStart = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
  ).toISOString();
  const todayEnd = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 1) - jstOffset
  ).toISOString();

  // 完了列を取得
  const { data: completedCol } = await supabase
    .from("columns")
    .select("id")
    .eq("title", "完了")
    .single();

  // 期限が今日のタスク（完了列以外）を取得
  let query = supabase
    .from("tasks")
    .select(
      "id, title, due_date, assignees:task_assignees(user_id, user:users(name, email))"
    )
    .gte("due_date", todayStart)
    .lt("due_date", todayEnd);

  if (completedCol) {
    query = query.neq("column_id", completedCol.id);
  }

  const { data: tasks, error } = await query;

  if (error) {
    console.error("Due today query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notifiedCount = 0;
  for (const task of tasks ?? []) {
    const assignees = task.assignees as unknown as { user: { name: string | null; email: string } }[];
    const assigneeNames = assignees
      ?.map((a) => a.user?.name ?? a.user?.email)
      .filter(Boolean)
      .join(", ") || "未アサイン";

    await notifyChat({
      type: "task_due_today",
      title: task.title,
      assigneeNames,
    }).catch(() => {});
    notifiedCount++;
  }

  return NextResponse.json({ notified: notifiedCount });
}
