import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Skill, CreateSkillInput } from "@workspace/shared";

export const Route = createFileRoute("/skills/")({
  component: SkillsPage,
});

const EMPTY_FORM: CreateSkillInput = {
  name: "",
  description: "",
  instructions: "",
  requiredTools: [],
};

function SkillsPage() {
  const { data: skills, isLoading } = useSkills();
  const createMutation = useCreateSkill();
  const updateMutation = useUpdateSkill();
  const deleteMutation = useDeleteSkill();

  const [editing, setEditing] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateSkillInput>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toolInput, setToolInput] = useState("");

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditing(null);
  }

  function openEdit(skill: Skill) {
    setEditing(skill);
    setForm({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      requiredTools: skill.requiredTools,
    });
    setCreating(false);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setToolInput("");
  }

  function addTool() {
    if (!toolInput.trim()) return;
    setForm((f) => ({ ...f, requiredTools: [...f.requiredTools, toolInput.trim()] }));
    setToolInput("");
  }

  function removeTool(idx: number) {
    setForm((f) => ({ ...f, requiredTools: f.requiredTools.filter((_, i) => i !== idx) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (creating) {
      createMutation.mutate(form, {
        onSuccess: () => {
          toast.success("Skill created");
          closeDialog();
        },
        onError: (err) => toast.error(err.message),
      });
    } else if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: form },
        {
          onSuccess: () => {
            toast.success("Skill saved");
            closeDialog();
          },
          onError: (err) => toast.error(err.message),
        },
      );
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast.success("Skill deleted");
        setDeleteId(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const dialogOpen = creating || !!editing;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reusable capabilities assigned to agents
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Skill
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !skills || skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No skills yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Create reusable skills to assign to your agents.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Skill
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {skills.map((skill) => (
            <Card key={skill.id} className="group overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                    {skill.name}
                  </CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(skill)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(skill.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {skill.description && (
                  <p className="text-sm text-muted-foreground">
                    {skill.description}
                  </p>
                )}
                {skill.requiredTools.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {skill.requiredTools.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs font-mono">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                {skill.instructions && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {skill.instructions}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New Skill" : "Edit Skill"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Web Research"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ability to search and summarize web content"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instructions</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, instructions: e.target.value }))
                }
                placeholder="When performing web research, always verify sources..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Required Tools</Label>
              <div className="flex gap-2">
                <Input
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  placeholder="http.fetch"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTool();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTool}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.requiredTools.map((t, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <span className="font-mono text-xs">{t}</span>
                    <button type="button" onClick={() => removeTool(i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                {creating ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Skill</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the skill. Agents referencing it will
            lose this skill.
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
