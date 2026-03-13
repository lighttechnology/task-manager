"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCreateTask, useUpdateTask, useDeleteTask, useMembers } from "@/hooks/useTasks";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { Task, Priority, Column } from "@/types";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  columnId: string;
  columns: Column[];
}

export function TaskModal({ open, onClose, task, columnId, columns }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [reviewerId, setReviewerId] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [syncCalendar, setSyncCalendar] = useState(true); // デフォルトON

  const { data: members } = useMembers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // 現在の列が「レビュー中」かどうか
  const currentColumnTitle = useMemo(() => {
    const colId = task ? task.column_id : columnId;
    return columns.find((c) => c.id === colId)?.title ?? "";
  }, [task, columnId, columns]);
  const isReviewColumn = currentColumnTitle === "レビュー中";

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssigneeIds(task.assignees?.map((a) => a.user_id) ?? []);
      setReviewerId(task.reviewer_id ?? "");
      setPriority(task.priority);

      if (task.due_date) {
        const d = new Date(task.due_date);
        const allDay = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
        setIsAllDay(allDay);
        if (allDay) {
          setDueDate(task.due_date.slice(0, 10));
        } else {
          setDueDate(task.due_date.slice(0, 16));
        }
      } else {
        setDueDate("");
        setIsAllDay(false);
      }

      setTagsInput(task.tags?.map((t) => t.name).join(", ") ?? "");
      setSyncCalendar(task.google_calendar_event_id ? true : true); // 既存もデフォルトON
    } else {
      setTitle("");
      setDescription("");
      setAssigneeIds([]);
      setReviewerId("");
      setPriority("medium");
      setDueDate("");
      setIsAllDay(false);
      setTagsInput("");
      setSyncCalendar(true); // デフォルトON
    }
  }, [task, open]);

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAllDayChange = (checked: boolean) => {
    setIsAllDay(checked);
    if (dueDate) {
      if (checked) {
        setDueDate(dueDate.slice(0, 10));
      } else {
        setDueDate(dueDate.slice(0, 10) + "T09:00");
      }
    }
  };

  const buildDueDateISO = (): string | null => {
    if (!dueDate) return null;
    if (isAllDay) {
      return new Date(dueDate + "T00:00:00+09:00").toISOString();
    }
    return new Date(dueDate).toISOString();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("タイトルは必須です");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const dueDateISO = buildDueDateISO();

    try {
      if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          title,
          description: description || null,
          assignee_ids: assigneeIds,
          reviewer_id: reviewerId || null,
          priority,
          due_date: dueDateISO,
          tags,
          sync_calendar: syncCalendar,
        });
        toast.success("タスクを更新しました");
      } else {
        await createTask.mutateAsync({
          title,
          description: description || null,
          column_id: columnId,
          assignee_ids: assigneeIds,
          reviewer_id: reviewerId || null,
          priority,
          due_date: dueDateISO,
          tags,
          sync_calendar: syncCalendar,
        });
        toast.success("タスクを作成しました");
      }
      onClose();
    } catch {
      toast.error("エラーが発生しました");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("タスクを削除しました");
      onClose();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const selectClassName =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{task ? "タスク編集" : "新規タスク"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="title">タイトル *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスク名を入力"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="タスクの詳細"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>担当者（複数選択可）</Label>
              <div className="max-h-[140px] overflow-y-auto rounded-md border border-input p-1 space-y-0.5">
                {members && members.length > 0 ? (
                  members.map((m) => {
                    const isSelected = assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleAssignee(m.id)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors text-left
                          ${isSelected ? "bg-indigo-50 dark:bg-indigo-950" : "hover:bg-gray-50 dark:hover:bg-gray-900"}`}
                      >
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
                            ${isSelected ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 dark:border-gray-600"}`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {m.name?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.name ?? m.email}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground p-2">メンバーなし</p>
                )}
              </div>
              {assigneeIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {assigneeIds.length}名 選択中
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">優先度</Label>
              <select
                id="priority"
                className={selectClassName}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>

          {/* レビュアー選択（レビュー中の列のタスクのみ表示） */}
          {isReviewColumn && (
            <div className="grid gap-2">
              <Label htmlFor="reviewer">レビュアー</Label>
              <select
                id="reviewer"
                className={selectClassName}
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
              >
                <option value="">未選択</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="due_date">期日</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="all_day"
                  checked={isAllDay}
                  onCheckedChange={handleAllDayChange}
                />
                <Label htmlFor="all_day" className="text-xs text-muted-foreground cursor-pointer">
                  終日
                </Label>
              </div>
            </div>
            <Input
              id="due_date"
              type={isAllDay ? "date" : "datetime-local"}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">タグ（カンマ区切り）</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="デザイン, バグ, 改善"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="sync_calendar"
              checked={syncCalendar}
              onCheckedChange={setSyncCalendar}
            />
            <Label htmlFor="sync_calendar">Googleカレンダーに同期</Label>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {task && (
            <Button variant="destructive" onClick={handleDelete}>
              削除
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit}>
              {task ? "更新" : "作成"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
