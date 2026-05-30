import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, GitBranch, Copy, Trash2, Play, Pencil, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import {
  useWorkflows,
  useDeleteWorkflow,
  useCloneWorkflow,
  useRunWorkflow,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TriggerType } from "@workspace/shared";

export const Route = createFileRoute("/workflows/")({
  component: WorkflowsList,
});

function triggerLabel(t: TriggerType) {
  switch (t) {
    case "manual":
      return "Manual";
    case "telegram_message":
      return "Telegram";
    case "schedule":
      return "Schedule";
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function WorkflowsList() {
  const navigate = useNavigate();
  const { data: workflows, isLoading } = useWorkflows();
  const deleteMutation = useDeleteWorkflow();
  const cloneMutation = useCloneWorkflow();
  const runMutation = useRunWorkflow();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState("");

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast.success("Workflow deleted");
        setDeleteId(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handleClone() {
    if (!cloneId || !cloneName.trim()) return;
    cloneMutation.mutate(
      { id: cloneId, data: { name: cloneName.trim() } },
      {
        onSuccess: (wf) => {
          toast.success("Workflow cloned");
          setCloneId(null);
          setCloneName("");
          navigate({ to: "/workflows/$workflowId", params: { workflowId: wf.id } });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleRun(id: string) {
    runMutation.mutate(
      { id },
      {
        onSuccess: (run) => {
          toast.success("Run started");
          navigate({ to: "/runs/$runId", params: { runId: run.id } });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build and manage agent workflows
          </p>
        </div>
        <Button asChild>
          <Link to="/workflows/$workflowId" params={{ workflowId: "new" }}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Workflow
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !workflows || workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No workflows yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Create your first workflow to orchestrate agents.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/workflows/$workflowId" params={{ workflowId: "new" }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Workflow
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Nodes</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((wf) => (
                <TableRow key={wf.id}>
                  <TableCell className="font-medium">{wf.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate text-sm">
                    {wf.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {triggerLabel(wf.triggerType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {wf.nodes.length}
                  </TableCell>
                  <TableCell>
                    {wf.isTemplate && (
                      <LayoutTemplate className="h-4 w-4 text-blue-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(wf.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Run"
                        onClick={() => handleRun(wf.id)}
                        disabled={runMutation.isPending}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" asChild>
                        <Link
                          to="/workflows/$workflowId"
                          params={{ workflowId: wf.id }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Clone"
                        onClick={() => {
                          setCloneId(wf.id);
                          setCloneName(`${wf.name} (copy)`);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(wf.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the workflow and all its history.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone dialog */}
      <Dialog open={!!cloneId} onOpenChange={(o) => !o && setCloneId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cloneName">New Name</Label>
            <Input
              id="cloneName"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleClone}
              disabled={!cloneName.trim() || cloneMutation.isPending}
            >
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
