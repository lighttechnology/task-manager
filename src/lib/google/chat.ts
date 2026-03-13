type NotificationType =
  | "task_created"
  | "status_changed"
  | "task_completed"
  | "task_deleted";

interface NotifyParams {
  type: NotificationType;
  title: string;
  assignee?: string;
  oldColumn?: string;
  newColumn?: string;
}

function buildMessage(params: NotifyParams): string {
  switch (params.type) {
    case "task_created":
      return `📋 新しいタスクが追加されました: ${params.title}`;
    case "status_changed":
      return `🔄 ${params.title} が ${params.oldColumn} → ${params.newColumn} に移動しました`;
    case "task_completed":
      return `✅ ${params.title} が完了しました！　担当: ${params.assignee ?? "未アサイン"}`;
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
