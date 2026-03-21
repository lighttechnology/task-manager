import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createTaskSchema } from "@/lib/validations";
import { notifyChat } from "@/lib/google/chat";
import { syncTaskToCalendar } from "@/lib/google/calendar";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);

  // Return columns
  if (searchParams.get("columns") === "true") {
    const { data, error } = await supabase
      .from("columns")
      .select("*")
      .order("position");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Return members
  if (searchParams.get("members") === "true") {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, avatar_url");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // 完了タスクの自動削除（completed_at カラムが存在する場合のみ）
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await supabase
    .from("tasks")
    .delete()
    .not("completed_at", "is", null)
    .lt("completed_at", threeDaysAgo);
  if (cleanupError) {
    console.log("Cleanup skipped (completed_at may not exist):", cleanupError.message);
  }

  // タスク取得: 段階的フォールバック
  // Step 1: reviewer + assignees + creator
  const r1 = await supabase
    .from("tasks")
    .select(
      "*, assignees:task_assignees(user_id, user:users(id, email, name, avatar_url)), reviewer:users!reviewer_id(id, email, name, avatar_url), creator:users!created_by(id, name, avatar_url)"
    )
    .order("position");

  if (!r1.error) {
    return NextResponse.json(r1.data);
  }
  console.log("Fallback 1 (reviewer/creator join failed):", r1.error.message);

  // Step 2: assignees のみ
  const r2 = await supabase
    .from("tasks")
    .select(
      "*, assignees:task_assignees(user_id, user:users(id, email, name, avatar_url))"
    )
    .order("position");

  if (!r2.error) {
    return NextResponse.json(r2.data);
  }
  console.log("Fallback 2 (task_assignees join failed):", r2.error.message);

  // Step 3: タスクのみ (JOIN なし)
  const r3 = await supabase
    .from("tasks")
    .select("*")
    .order("position");

  if (!r3.error) {
    // assignees を空配列として返す
    const tasksWithDefaults = r3.data.map((t: Record<string, unknown>) => ({
      ...t,
      assignees: [],
    }));
    return NextResponse.json(tasksWithDefaults);
  }

  return NextResponse.json({ error: r3.error.message }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sync_calendar, tags, assignee_ids, reviewer_id, ...taskFields } = parsed.data;
  const supabase = createServerClient();

  // Get max position in column
  const { data: maxPos } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", taskFields.column_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  // INSERT用のデータを明示的に構築
  const insertData: Record<string, unknown> = {
    title: taskFields.title,
    description: taskFields.description || null,
    column_id: taskFields.column_id,
    priority: taskFields.priority,
    due_date: taskFields.due_date || null,
    position,
    created_by: session.user.id,
  };

  if (reviewer_id) {
    insertData.reviewer_id = reviewer_id;
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    console.error("Task insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 担当者を中間テーブルに挿入
  if (assignee_ids && assignee_ids.length > 0) {
    const rows = assignee_ids.map((user_id) => ({
      task_id: task.id,
      user_id,
    }));
    const { error: assigneeError } = await supabase.from("task_assignees").insert(rows);
    if (assigneeError) {
      console.error("Assignee insert error:", assigneeError);
    }
  }

  // Calendar sync — 担当者(B)のカレンダーに登録する
  if (sync_calendar && task.due_date) {
    const targetUserIds =
      assignee_ids && assignee_ids.length > 0
        ? assignee_ids
        : [session.user.id]; // 担当者未指定なら作成者

    for (const userId of targetUserIds) {
      try {
        let token: string | undefined;
        if (userId === session.user.id) {
          token = session.access_token;
        } else {
          // 担当者のアクセストークンをDBから取得
          const { data: u } = await supabase
            .from("users")
            .select("google_access_token")
            .eq("id", userId)
            .single();
          token = u?.google_access_token ?? undefined;
        }
        if (!token) continue;

        const eventId = await syncTaskToCalendar(task, token);
        if (eventId && !task.google_calendar_event_id) {
          await supabase
            .from("tasks")
            .update({ google_calendar_event_id: eventId })
            .eq("id", task.id);
          task.google_calendar_event_id = eventId;
        }
      } catch (calErr) {
        console.error(`Calendar sync error for user ${userId}:`, calErr);
      }
    }
  }

  // Chat notification — 依頼者・担当者名を含める
  {
    const creatorName = session.user.name ?? session.user.email ?? "不明";
    let assigneeNameList = "未アサイン";
    if (assignee_ids && assignee_ids.length > 0) {
      const { data: assigneeUsers } = await supabase
        .from("users")
        .select("name, email")
        .in("id", assignee_ids);
      if (assigneeUsers && assigneeUsers.length > 0) {
        assigneeNameList = assigneeUsers
          .map((u) => u.name ?? u.email)
          .join(", ");
      }
    }
    let dueDateStr: string | undefined;
    if (task.due_date) {
      const d = new Date(task.due_date);
      dueDateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    }
    notifyChat({
      type: "task_created",
      title: task.title,
      creatorName,
      assigneeNames: assigneeNameList,
      dueDate: dueDateStr,
    }).catch(() => {});
  }

  // 担当者情報を含めて返す
  const { data: fullTask } = await supabase
    .from("tasks")
    .select(
      "*, assignees:task_assignees(user_id, user:users(id, email, name, avatar_url))"
    )
    .eq("id", task.id)
    .single();

  return NextResponse.json(fullTask ?? task, { status: 201 });
}
