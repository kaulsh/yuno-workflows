import { createFileRoute } from "@tanstack/react-router";
import { Wrench, Code } from "lucide-react";
import { useTools } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/tools/")({
  component: ToolsPage,
});

function ToolsPage() {
  const { data, isLoading } = useTools();
  const tools = data?.tools ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tools</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Available tools that agents can use
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No tools available</h3>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {tools.map((tool) => (
            <Card key={tool.name} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-mono">{tool.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tool.description}
                </p>
                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Badge variant="outline" className="text-xs">
                        Input Schema
                      </Badge>
                    </div>
                    <ScrollArea className="h-28">
                      <pre className="text-xs font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
