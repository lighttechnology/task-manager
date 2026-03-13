"use client";

import { useState, useCallback, useMemo } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "./KanbanColumn";
import { TaskModal } from "./TaskModal";
import { ReviewerSelectModal } from "./ReviewerSelectModal";
import { UserFilter } from "./UserFilter";
import { useBoard, useUpdateTask } from "@/hooks/useTasks";
import { useRealtime } from "@/hooks/useRealtime";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Task, BoardData, Column } from "@/types";

// 期限が近い順にソートすべき列名
const SORT_BY_DUE_COLUMNS = ["進行中", "レビュー中"];

function sortTasksForColumn(tasks: Task[], column: Column): Task[] {
  if (!SORT_BY_DUE_COLUMNS.includes(column.title)) {
    return tasks;
  }
  return [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return a.position - b.position;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}

export function KanbanBoard() {
  const { data: board, isLoading } = useBoard();
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();
  useRealtime();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string>("");

  // ユーザーフィルター
  const [filterUserId, setFilterUserId] = useState<string>("all");

  // レビュアー選択モーダル用
  const [reviewerModalOpen, setReviewerModalOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    taskId: string;
    taskTitle: string;
    newColumnId: string;
  } | null>(null);

  // フィルタ適用後のボードデータ
  const filteredAndSortedBoard = useMemo(() => {
    if (!board) return null;
    const filteredTasks: Record<string, Task[]> = {};
    for (const col of board.columns) {
      let tasks = board.tasks[col.id] ?? [];
      // ユーザーフィルター適用
      if (filterUserId !== "all") {
        tasks = tasks.filter(
          (t) =>
            t.assignees?.some((a) => a.user_id === filterUserId) ||
            t.created_by === filterUserId
        );
      }
      filteredTasks[col.id] = sortTasksForColumn(tasks, col);
    }
    return { ...board, tasks: filteredTasks };
  }, [board, filterUserId]);

  // レビュー中の列IDを取得
  const reviewColumnId = useMemo(() => {
    return board?.columns.find((c) => c.title === "レビュー中")?.id ?? null;
  }, [board]);

  const handleAddTask = useCallback((columnId: string) => {
    setEditingTask(null);
    setActiveColumnId(columnId);
    setModalOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setActiveColumnId(task.column_id);
    setModalOpen(true);
  }, []);

  // タスクを実際に移動する共通関数
  const doMoveTask = useCallback(
    async (taskId: string, newColumnId: string, reviewerId?: string) => {
      const prev = queryClient.getQueryData<BoardData>(["board"]);

      // 即座にUIを更新（optimistic）
      queryClient.setQueryData<BoardData>(["board"], (old) => {
        if (!old) return old;
        const newTasks = { ...old.tasks };

        let movedTask: Task | undefined;
        for (const colId of Object.keys(newTasks)) {
          const idx = newTasks[colId].findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            const col = [...newTasks[colId]];
            [movedTask] = col.splice(idx, 1);
            newTasks[colId] = col;
            break;
          }
        }
        if (!movedTask) return old;

        const destCol = [...(newTasks[newColumnId] ?? [])];
        destCol.unshift({
          ...movedTask,
          column_id: newColumnId,
          position: 0,
          reviewer_id: reviewerId ?? movedTask.reviewer_id,
        });
        newTasks[newColumnId] = destCol;

        return { ...old, tasks: newTasks };
      });

      try {
        const payload: Record<string, unknown> = {
          id: taskId,
          column_id: newColumnId,
          position: 0,
        };
        if (reviewerId) {
          payload.reviewer_id = reviewerId;
        }
        await updateTask.mutateAsync(payload as Parameters<typeof updateTask.mutateAsync>[0]);
        // 成功 → サーバーの最新データで更新
        queryClient.invalidateQueries({ queryKey: ["board"] });
        toast.success("移動しました");
      } catch (err) {
        // 失敗 → 元に戻す
        queryClient.setQueryData(["board"], prev);
        const msg = err instanceof Error ? err.message : "移動に失敗しました";
        toast.error(msg);
      }
    },
    [updateTask, queryClient]
  );

  // タスクのレビュアー設定済みか確認するヘルパー
  const findTask = useCallback(
    (taskId: string): Task | undefined => {
      const currentBoard = queryClient.getQueryData<BoardData>(["board"]);
      if (!currentBoard) return undefined;
      for (const tasks of Object.values(currentBoard.tasks)) {
        const found = tasks.find((t) => t.id === taskId);
        if (found) return found;
      }
      return undefined;
    },
    [queryClient]
  );

  // ボタンで列を移動する
  const handleMoveColumn = useCallback(
    async (taskId: string, newColumnId: string) => {
      // レビュー中への移動時はレビュアー選択を要求
      if (newColumnId === reviewColumnId) {
        const task = findTask(taskId);
        if (!task?.reviewer_id) {
          setPendingMove({
            taskId,
            taskTitle: task?.title ?? "",
            newColumnId,
          });
          setReviewerModalOpen(true);
          return;
        }
      }

      await doMoveTask(taskId, newColumnId);
    },
    [reviewColumnId, findTask, doMoveTask]
  );

  // レビュアー選択確定後の移動
  const handleReviewerConfirm = useCallback(
    async (reviewerId: string) => {
      setReviewerModalOpen(false);
      if (!pendingMove) return;
      await doMoveTask(pendingMove.taskId, pendingMove.newColumnId, reviewerId);
      setPendingMove(null);
    },
    [pendingMove, doMoveTask]
  );

  const handleReviewerCancel = useCallback(() => {
    setReviewerModalOpen(false);
    setPendingMove(null);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination || !board) return;

      const { source, destination, draggableId } = result;

      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      // レビュー中への移動時はレビュアー選択を要求
      if (destination.droppableId === reviewColumnId) {
        const task = findTask(draggableId);
        if (!task?.reviewer_id) {
          setPendingMove({
            taskId: draggableId,
            taskTitle: task?.title ?? "",
            newColumnId: destination.droppableId,
          });
          setReviewerModalOpen(true);
          return;
        }
      }

      // Optimistic update
      const prev = queryClient.getQueryData<BoardData>(["board"]);

      queryClient.setQueryData<BoardData>(["board"], (old) => {
        if (!old) return old;
        const newTasks = { ...old.tasks };

        const sourceCol = [...(newTasks[source.droppableId] ?? [])];
        const destCol =
          source.droppableId === destination.droppableId
            ? sourceCol
            : [...(newTasks[destination.droppableId] ?? [])];

        const [moved] = sourceCol.splice(source.index, 1);
        if (!moved) return old;

        const updatedTask = { ...moved, column_id: destination.droppableId };
        destCol.splice(destination.index, 0, updatedTask);

        newTasks[source.droppableId] = sourceCol;
        newTasks[destination.droppableId] = destCol;

        return { ...old, tasks: newTasks };
      });

      try {
        await updateTask.mutateAsync({
          id: draggableId,
          column_id: destination.droppableId,
          position: destination.index,
        });
        // 成功 → サーバーの最新データで更新
        queryClient.invalidateQueries({ queryKey: ["board"] });
      } catch {
        queryClient.setQueryData(["board"], prev);
        toast.error("移動に失敗しました");
      }
    },
    [board, queryClient, updateTask, reviewColumnId, findTask]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!filteredAndSortedBoard) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        データの取得に失敗しました
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 p-4 overflow-x-auto h-full">
          {filteredAndSortedBoard.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={filteredAndSortedBoard.tasks[column.id] ?? []}
              columns={filteredAndSortedBoard.columns}
              onAddTask={() => handleAddTask(column.id)}
              onEditTask={handleEditTask}
              onMoveColumn={handleMoveColumn}
            />
          ))}

          {/* ユーザーフィルター（完了列の右横） */}
          <div className="shrink-0 w-[200px]">
            <UserFilter value={filterUserId} onChange={setFilterUserId} />
          </div>
        </div>
      </DragDropContext>

      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        columnId={activeColumnId}
        columns={filteredAndSortedBoard.columns}
      />

      <ReviewerSelectModal
        open={reviewerModalOpen}
        onClose={handleReviewerCancel}
        onConfirm={handleReviewerConfirm}
        taskTitle={pendingMove?.taskTitle ?? ""}
      />
    </>
  );
}
