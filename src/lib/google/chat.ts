type NotificationType =
  | "task_created"
  | "status_changed"
  | "task_completed"
  | "task_deleted";

interface NotifyParams {
  type: NotificationType;
  title: string;
  creatorName?: string;
  assigneeNames?: string;
  dueDate?: string;
  oldColumn?: string;
  newColumn?: string;
}

function buildMessage(params: NotifyParams): string {
  const creator = params.creatorName ?? "不明";
  const assignee = params.assigneeNames || "未アサイン";

  switch (params.type) {
    case "task_created": {
      let msg = `📋 新しいタスクが依頼されました\nタスク: 「${params.title}」\n依頼者: ${creator}\n担当者: ${assignee}`;
      if (params.dueDate) {
        msg += `\n期限: ${params.dueDate}`;
      }
      return msg;
    }
    case "status_changed":
      return `🔄 ${params.title} が ${params.oldColumn} → ${params.newColumn} に移動しました`;
    case "task_completed":
      return `✅ タスクが完了しました！\nタスク: 「${params.title}」\n依頼者: ${creator}\n担当者: ${assignee}`;
    case "task_deleted":
      return `🗑️ ${params.title} が削除されました`;
  }
}

export async function notifyChat(params: NotifyParams): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = buildMessage(params);

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ text }),
  });
}
