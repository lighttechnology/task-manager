"use client";

import { Droppable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Task, Column } from "@/types";

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  columns: Column[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onMoveColumn: (taskId: string, newColumnId: string) => void;
}

export function KanbanColumn({ column, tasks, columns, onAddTask, onEditTask, onMoveColumn }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-gray-50 dark:bg-gray-900 rounded-xl">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <span className="text-xs text-muted-foreground bg-gray-200 dark:bg-gray-800 rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddTask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 min-h-[100px] transition-colors rounded-b-xl
              ${snapshot.isDraggingOver ? "bg-indigo-50 dark:bg-indigo-950/30" : ""}`}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onClick={() => onEditTask(task)}
                columns={columns}
                onMoveColumn={onMoveColumn}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
