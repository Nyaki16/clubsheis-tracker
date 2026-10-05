"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Profile, Task } from "@/lib/types";
import { getTaskContext } from "@/app/actions/task-view";
import TaskDrawer from "./task-drawer";

/**
 * The task side panel for lists that only know the task (Daily Scroll, a
 * client's other jobs). Loads the client and their tasks, then shows the same
 * drawer as the client page. `task` comes from the list so edits show at once.
 */
export default function TaskPanel({ task, profiles, onClose }: { task: Task; profiles: Profile[]; onClose: () => void }) {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getTaskContext>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    getTaskContext(task.id)
      .then((c) => alive && setCtx(c))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't open the task."));
    return () => {
      alive = false;
    };
  }, [task.id]);

  if (!ctx) {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
        <aside className="w-full max-w-xl h-full bg-white dark:bg-slate-900 p-6 text-sm text-slate-500" onClick={(e) => e.stopPropagation()}>
          {error || "Opening the task…"}
        </aside>
      </div>,
      document.body
    );
  }
  return createPortal(
    <TaskDrawer task={task} client={ctx.client} clientTasks={ctx.clientTasks} profiles={profiles} tiers={ctx.tiers} onClose={onClose} />,
    document.body
  );
}
