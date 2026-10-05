"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Modal from "@/components/modal";
import { JobForm } from "@/components/forms";
import { createJob } from "@/app/actions/jobs";
import { useToast } from "@/components/flow/ui";

export default function NewJobButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-slate-800"
      >
        <Plus className="w-4 h-4" /> New job
      </button>
      {open && (
        <Modal title="New job" onClose={() => setOpen(false)}>
          <JobForm
            onSubmit={async (name, dueDate, _c, templateId) => {
              const r = await createJob(clientId, name, dueDate || null, templateId);
              toast(r.message);
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
