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
  reviewerName?: string;
}

function buildMessage(params: NotifyParams): string {
  const hasAssignee = !!params.assigneeNames;
  const assignee = params.assigneeNames ?? "";
  const operator = params.operatorName ?? "不明";
  const creator = params.creatorName ?? "不明";

  switch (params.type) {
    case "task_created":
      return hasAssignee
        ? `📋 ${creator}が${assignee}に${params.title}のタスクを追加しました。`
        : `📋 ${creator}が${params.title}のタスクを追加しました。`;
    case "task_completed":
      return hasAssignee
        ? `✅ ${assignee}の${params.title}のタスクを${operator}が完了にしました。`
        : `✅ ${params.title}のタスクを${operator}が完了にしました。`;
    case "status_changed": {
      let msg = hasAssignee
        ? `🔄 ${assignee}の${params.title}のタスクが${operator}によって${params.newColumn}に移行されました。`
        : `🔄 ${params.title}のタスクが${operator}によって${params.newColumn}に移行されました。`;
      if (params.newColumn === "レビュー中" && params.reviewerName) {
        msg += `\nレビューは${params.reviewerName}に依頼されました。`;
      }
      return msg;
    }
    case "task_deleted":
      return hasAssignee
        ? `🗑️ ${assignee}の${params.title}のタスクが${operator}によって削除されました。`
        : `🗑️ ${params.title}のタスクが${operator}によって削除されました。`;
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
