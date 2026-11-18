import { listTasks } from "@/lib/store";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default function Tasks() {
  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">Tasks</h1><p className="text-muted text-sm">Internal tracking only. Nothing here commits you to an external action.</p></header>
      <TaskBoard tasks={listTasks()} />
    </div>
  );
}
