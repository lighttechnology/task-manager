import { KanbanBoard } from "@/components/board/KanbanBoard";
import { Header } from "@/components/layout/Header";

export default function BoardPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-hidden">
        <KanbanBoard />
      </main>
    </div>
  );
}
