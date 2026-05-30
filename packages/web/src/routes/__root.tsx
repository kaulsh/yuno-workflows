import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  Play,
  Wrench,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/workflows", label: "Workflows", icon: GitBranch },
  { to: "/runs", label: "Runs", icon: Play },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/skills", label: "Skills", icon: Lightbulb },
] as const;

function RootLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="px-4 py-5 border-b">
          <span className="text-lg font-bold tracking-tight">Yuno</span>
          <p className="text-xs text-muted-foreground mt-0.5">Agent Platform</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={to === "/" ? { exact: true } : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              activeProps={{
                className:
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-accent text-foreground",
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground">v0.1.0</p>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
