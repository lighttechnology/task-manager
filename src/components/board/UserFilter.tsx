"use client";

import { useMembers } from "@/hooks/useTasks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";

interface UserFilterProps {
  value: string;
  onChange: (userId: string) => void;
}

export function UserFilter({ value, onChange }: UserFilterProps) {
  const { data: members } = useMembers();

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">表示フィルター</h3>
      </div>

      <div className="space-y-1">
        {/* 全体 */}
        <button
          type="button"
          onClick={() => onChange("all")}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-left
            ${value === "all" ? "bg-indigo-100 dark:bg-indigo-950 font-medium" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
            <Users className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
          </div>
          <span>全体</span>
        </button>

        {/* 各メンバー */}
        {members?.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-left
              ${value === m.id ? "bg-indigo-100 dark:bg-indigo-950 font-medium" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          >
            <Avatar size="sm">
              {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
              <AvatarFallback className="text-[9px]">
                {m.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{m.name ?? m.email}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
