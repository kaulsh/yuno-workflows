import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Bot } from "lucide-react";
import { toast } from "sonner";
import { useAgents, useDeleteAgent } from "@/lib/queries";
import { displayChannels } from "@/lib/agent-channels";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";

export const Route = createFileRoute("/agents/")({
  component: AgentsList,
});

function AgentsList() {
  const { data: agents, isLoading } = useAgents();
  const deleteMutation = useDeleteAgent();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast.success("Agent deleted");
        setDeleteId(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button asChild>
          <Link to="/agents/$agentId" params={{ agentId: "new" }}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Agent
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No agents yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Create your first AI agent to get started.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/agents/$agentId" params={{ agentId: "new" }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Agent
            </Link>
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Tools</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => {
                const visibleChannels = displayChannels(agent.channels);
                return (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {agent.role}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {agent.model}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {visibleChannels.length === 0 ? (
                      <span className="text-muted-foreground text-sm">—</span>
                    ) : (
                      <div className="flex gap-1">
                        {visibleChannels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          to="/agents/$agentId"
                          params={{ agentId: agent.id }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(agent.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. This will permanently delete the agent.
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
    </div>
  );
}
