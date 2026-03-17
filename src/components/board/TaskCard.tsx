"use client";

import { Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import type { Task, Column } from "@/types";

const priorityConfig = {
  high: { label: "高", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  medium: { label: "中", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  low: { label: "低", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
};

function MiniAvatar({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  const initial = name?.charAt(0) ?? "?";
  return (
    <div
      className="relative h-5 w-5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center overflow-hidden ring-1.5 ring-white dark:ring-gray-900"
      title={name ?? undefined}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name ?? ""}
          className="h-full w-full rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[8px] font-medium text-indigo-700 dark:text-indigo-300">
          {initial}
        </span>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: () => void;
  columns: Column[];
  onMoveColumn: (taskId: string, newColumnId: string) => void;
}

export function TaskCard({ task, index, onClick, columns, onMoveColumn }: TaskCardProps) {
  const priority = priorityConfig[task.priority];
  const isOverdue =
    task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const assignees = task.assignees ?? [];

  const currentColIndex = columns.findIndex((c) => c.id === task.column_id);
  const canMoveLeft = currentColIndex > 0;
  const canMoveRight = currentColIndex < columns.length - 1;

  // レビュアー情報を表示
  const reviewer = task.reviewer;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`rounded-md border bg-white dark:bg-gray-900 px-2 py-1.5 cursor-pointer transition-shadow
            ${snapshot.isDragging ? "shadow-xl scale-[1.02]" : "hover:shadow-md"}`}
          onClick={onClick}
        >
          {/* タイトル + 右上アバター */}
          <div className="flex items-center justify-between gap-1">
            <h4 className="font-medium text-xs leading-tight flex-1 min-w-0 truncate">{task.title}</h4>
            {assignees.length > 0 && (
              <div className="flex shrink-0 -space-x-1.5">
                {assignees.slice(0, 3).map((a) => (
                  <MiniAvatar
                    key={a.user_id}
                    name={a.user?.name}
                    avatarUrl={a.user?.avatar_url}
                  />
                ))}
                {assignees.length > 3 && (
                  <div className="relative h-5 w-5 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
                    <span className="text-[8px] font-medium text-gray-600 dark:text-gray-300">
                      +{assignees.length - 3}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 優先度 + 日付 を同じ行に */}
          <div className="flex items-center gap-1 mt-0.5">
            <Badge variant="secondary" className={`${priority.className} text-[10px] px-1.5 py-0`}>
              {priority.label}
            </Badge>

            {task.due_date && (
              <span
                className={`flex items-center gap-0.5 text-[11px] ${
                  isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                }`}
              >
                <Calendar className="h-3 w-3" />
                {format(new Date(task.due_date), "M/d (E)", { locale: ja })}
              </span>
            )}

            {task.tags && task.tags.length > 0 && (
              <>
                {task.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="text-[10px] px-1 py-0">
                    {tag.name}
                  </Badge>
                ))}
              </>
            )}
          </div>

          {/* レビュアー表示 */}
          {reviewer && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>{reviewer.name ?? reviewer.email}</span>
            </div>
          )}

          {/* 列移動ボタン */}
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              disabled={!canMoveLeft}
              onClick={(e) => {
                e.stopPropagation();
                if (canMoveLeft) onMoveColumn(task.id, columns[currentColIndex - 1].id);
              }}
              title={canMoveLeft ? `← ${columns[currentColIndex - 1].title}` : undefined}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-[9px] text-muted-foreground">
              {columns[currentColIndex]?.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              disabled={!canMoveRight}
              onClick={(e) => {
                e.stopPropagation();
                if (canMoveRight) onMoveColumn(task.id, columns[currentColIndex + 1].id);
              }}
              title={canMoveRight ? `${columns[currentColIndex + 1].title} →` : undefined}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </Draggable>
  );
}
