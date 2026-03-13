"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, Column, BoardData } from "@/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validations";

async function fetchBoard(): Promise<BoardData> {
  const [tasksRes, columnsRes] = await Promise.all([
    fetch("/api/tasks"),
    fetch("/api/tasks?columns=true"),
  ]);
  if (!tasksRes.ok || !columnsRes.ok) throw new Error("Failed to fetch board");
  const tasks: Task[] = await tasksRes.json();
  const columns: Column[] = await columnsRes.json();

  const grouped: Record<string, Task[]> = {};
  for (const col of columns) {
    grouped[col.id] = [];
  }
  for (const task of tasks) {
    if (grouped[task.column_id]) {
      grouped[task.column_id].push(task);
    }
  }
  // Sort tasks by position
  for (const colId of Object.keys(grouped)) {
    grouped[colId].sort((a, b) => a.position - b.position);
  }

  return { columns: columns.sort((a, b) => a.position - b.position), tasks: grouped };
}

export function useBoard() {
  return useQuery<BoardData>({
    queryKey: ["board"],
    queryFn: fetchBoard,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create task");
      }
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateTaskInput & { id: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update task");
      }
      return res.json() as Promise<Task>;
    },
    // 移動後にinvalidateしない（optimistic updateを保持）
    // 代わりにKanbanBoard側で手動制御する
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useMembers() {
  return useQuery<{ id: string; email: string; name: string | null; avatar_url: string | null }[]>({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await fetch("/api/tasks?members=true");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });
}
