import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { updateTaskSchema } from "@/lib/validations";
import { notifyChat } from "@/lib/google/chat";
import { syncTaskToCalendar } from "@/lib/google/calendar";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sync_calendar, tags, assignee_ids, reviewer_id: rawReviewerId, ...rawUpdate } = parsed.data;
  // 空文字列は null として扱う
  const reviewer_id = rawReviewerId === "" ? null : rawReviewerId;
  const supabase = createServerClient();

  // Get existing task for comparison
  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    console.error("Task fetch error:", existingError);
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // 既存タスクの列タイトルを取得
  const { data: existingCol } = await supabase
    .from("columns")
    .select("title")
    .eq("id", existing.column_id)
    .single();

  // レビュー中に移動する場合、reviewer_id が必須
  if (rawUpdate.column_id && rawUpdate.column_id !== existing.column_id) {
    const { data: destCol } = await supabase
      .from("columns")
      .select("title")
      .eq("id", rawUpdate.column_id)
      .single();

    if (destCol?.title === "レビュー中" && !reviewer_id && !existing.reviewer_id) {
      return NextResponse.json(
        { error: "レビュー中に移動するにはレビュアーの選択が必要です", code: "REVIEWER_REQUIRED" },
        { status: 400 }
      );
    }
  }

  // UPDATE用のデータを明示的に構築（undefined を含めない）
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rawUpdate.title !== undefined) updatePayload.title = rawUpdate.title;
  if (rawUpdate.description !== undefined) updatePayload.description = rawUpdate.description;
  if (rawUpdate.column_id !== undefined) updatePayload.column_id = rawUpdate.column_id;
  if (rawUpdate.priority !== undefined) updatePayload.priority = rawUpdate.priority;
  if (rawUpdate.due_date !== undefined) updatePayload.due_date = rawUpdate.due_date;
  if (rawUpdate.position !== undefined) updatePayload.position = rawUpdate.position;

  // reviewer_id が明示的に渡された場合のみセット（null もセット可能）
  if (reviewer_id !== undefined) {
    updatePayload.reviewer_id = reviewer_id ?? null;
  }

  // 完了列に移動した場合 completed_at を記録、完了列から出た場合はクリア
  if (rawUpdate.column_id && rawUpdate.column_id !== existing.column_id) {
    const { data: destCol } = await supabase
      .from("columns")
      .select("title")
      .eq("id", rawUpdate.column_id)
      .single();

    if (destCol?.title === "完了") {
      updatePayload.completed_at = new Date().toISOString();
    } else if (existing.completed_at) {
      updatePayload.completed_at = null;
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("Task update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 担当者の差し替え（指定された場合のみ）
  if (assignee_ids !== undefined) {
    const { error: delErr } = await supabase.from("task_assignees").delete().eq("task_id", id);
    if (!delErr && assignee_ids.length > 0) {
      const rows = assignee_ids.map((user_id) => ({
        task_id: id,
        user_id,
      }));
      await supabase.from("task_assignees").insert(rows);
    }
  }

  // 更新後のタスクを取得（フォールバック付き）
  const { data: taskWithAssignees } = await supabase
    .from("tasks")
    .select(
      "*, assignees:task_assignees(user_id, user:users(id, email, name, avatar_url))"
    )
    .eq("id", id)
    .single();

  // task_assignees が存在しない場合はフォールバック
  const task = taskWithAssignees ?? (await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single()
  ).data;

  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // assignees がない場合は空配列をセット
  if (!task.assignees) {
    task.assignees = [];
  }

  // Calendar sync — 担当者のカレンダーに同期
  if (sync_calendar && task.due_date) {
    const taskAssigneeIds = (task.assignees ?? []).map(
      (a: { user_id: string }) => a.user_id
    );
    const targetUserIds =
      taskAssigneeIds.length > 0 ? taskAssigneeIds : [session.user.id];

    for (const userId of targetUserIds) {
      try {
        let token: string | undefined;
        if (userId === session.user.id) {
          token = session.access_token;
        } else {
          const { data: u } = await supabase
            .from("users")
            .select("google_access_token")
            .eq("id", userId)
            .single();
          token = u?.google_access_token ?? undefined;
        }
        if (!token) continue;

        const eventId = await syncTaskToCalendar(task, token);
        if (eventId && eventId !== task.google_calendar_event_id) {
          await supabase
            .from("tasks")
            .update({ google_calendar_event_id: eventId })
            .eq("id", id);
        }
      } catch (calErr) {
        console.error(`Calendar sync error for user ${userId}:`, calErr);
      }
    }
  }

  // Chat notifications
  if (rawUpdate.column_id && rawUpdate.column_id !== existing.column_id) {
    const { data: newCol } = await supabase
      .from("columns")
      .select("title")
      .eq("id", rawUpdate.column_id)
      .single();

    const oldColTitle = existingCol?.title ?? "";
    const newColTitle = newCol?.title ?? "";

    const assigneeNameList = task.assignees
      ?.map((a: { user: { name: string | null; email: string } }) => a.user?.name ?? a.user?.email)
      .filter(Boolean)
      .join(", ") || "未アサイン";

    // 依頼者名を取得
    let creatorName = "不明";
    if (existing.created_by) {
      const { data: creatorUser } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", existing.created_by)
        .single();
      if (creatorUser) {
        creatorName = creatorUser.name ?? creatorUser.email;
      }
    }

    if (newColTitle === "完了") {
      notifyChat({
        type: "task_completed",
        title: task.title,
        creatorName,
        assigneeNames: assigneeNameList,
      }).catch(() => {});
    } else {
      notifyChat({
        type: "status_changed",
        title: task.title,
        oldColumn: oldColTitle,
        newColumn: newColTitle,
      }).catch(() => {});
    }
  }

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("title, google_calendar_event_id")
    .eq("id", id)
    .single();

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // ※ Google カレンダーの予定はタスク削除時も残す（片方向同期）

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyChat({ type: "task_deleted", title: task.title }).catch(() => {});

  return NextResponse.json({ success: true });
}
