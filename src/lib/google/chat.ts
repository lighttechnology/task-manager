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
  completedByName?: string;
  oldColumn?: string;
  newColumn?: string;
}

function buildMessage(params: NotifyParams): string {
  switch (params.type) {
    case "task_created":
      return `${params.creatorName ?? "不明"}が${params.assigneeNames ?? "未アサイン"}に${params.title}のタスクを追加しました。`;
    case "task_completed":
      return `${params.assigneeNames ?? "不明"}の${params.title}のタスクを完了しました。`;
    case "status_changed":
      return `${params.assigneeNames ?? "不明"}の${params.title}のタスクが${params.newColumn}に移行されました`;
    case "task_deleted":
      return `🗑️ ${params.assigneeNames ?? "不明"}の${params.title}のタスクが削除されました`;
    case "task_due_today":
      return `${params.assigneeNames ?? "不明"}の${params.title}のタスクが本日までになります。`;
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
