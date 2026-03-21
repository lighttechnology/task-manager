type NotificationType =
  | "task_created"
  | "status_changed"
  | "task_completed"
  | "task_deleted"
  | "task_due_today";

interface NotifyParams {
  type: NotificationType;
  title: string;
  creatorName?: string;
  assigneeNames?: string;
  operatorName?: string;
  oldColumn?: string;
  newColumn?: string;
}

function buildMessage(params: NotifyParams): string {
  const assignee = params.assigneeNames ?? "不明";
  const operator = params.operatorName ?? "不明";

  switch (params.type) {
    case "task_created":
      return `📋 ${params.creatorName ?? "不明"}が${assignee}に${params.title}のタスクを追加しました。`;
    case "task_completed":
      return `✅ ${assignee}の${params.title}のタスクを${operator}が完了にしました。`;
    case "status_changed":
      return `🔄 ${assignee}の${params.title}のタスクが${operator}によって${params.newColumn}に移行されました。`;
    case "task_deleted":
      return `🗑️ ${assignee}の${params.title}のタスクが${operator}によって削除されました。`;
    case "task_due_today":
      return `⏰ ${assignee}の${params.title}のタスクが本日までになります。`;
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
