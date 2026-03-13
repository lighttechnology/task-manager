"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMembers } from "@/hooks/useTasks";

interface ReviewerSelectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reviewerId: string) => void;
  taskTitle: string;
}

export function ReviewerSelectModal({
  open,
  onClose,
  onConfirm,
  taskTitle,
}: ReviewerSelectModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const { data: members } = useMembers();

  const handleConfirm = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
    setSelectedId("");
  };

  const handleClose = () => {
    setSelectedId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>レビュアーを選択</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-3">
            「{taskTitle}」をレビュー中に移動するには、レビュアーを選択してください。
          </p>

          <Label className="mb-2 block">レビュアー *</Label>
          <div className="max-h-[200px] overflow-y-auto rounded-md border border-input p-1 space-y-0.5">
            {members && members.length > 0 ? (
              members.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors text-left
                      ${isSelected ? "bg-indigo-50 dark:bg-indigo-950 ring-1 ring-indigo-500" : "hover:bg-gray-50 dark:hover:bg-gray-900"}`}
                  >
                    <Avatar size="sm">
                      {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                      <AvatarFallback className="text-[9px]">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            レビュー中に移動
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
