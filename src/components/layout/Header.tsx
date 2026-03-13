"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, LayoutDashboard } from "lucide-react";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b bg-white dark:bg-gray-950 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-indigo-500" />
        <h1 className="text-lg font-bold">タスク管理</h1>
      </div>
      <div className="flex items-center gap-2">
        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<button className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity" />}>
                <span className="text-sm hidden sm:inline">
                  {session.user.name}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.image ?? undefined} />
                  <AvatarFallback>
                    {session.user.name?.charAt(0) ?? "U"}
                  </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/auth/signin" })}>
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
