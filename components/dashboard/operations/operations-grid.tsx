import { loadDashboardOperations } from "@/lib/services/dashboard-service";
import { BlockErrorBoundary } from "./block-error-boundary";
import { ConfigurableGrid } from "./configurable-grid";
import { BLOCK_REGISTRY } from "./registry";

/**
 * Server component: fetches every block in parallel (each fetcher resolves to a result, never throws),
 * renders the registry, and hands the pills + their blocks to the client-side grid.
 * Each block sits in its own error boundary.
 */
export async function OperationsGrid({ orgId, userId }: { orgId: string; userId: string }) {
  if (!orgId) return null;

  const now = new Date();
  const ops = await loadDashboardOperations(orgId, now);

  const blocks = BLOCK_REGISTRY.filter((b) => !b.hidden).map((block) => {
    const Icon = block.meta.icon;
    return {
      id: block.meta.id,
      title: block.meta.title,
      priority: block.meta.priority,
      defaultVisible: block.defaultVisible,
      // Icons are components, which can't cross the server/client boundary, so render it here.
      icon: <Icon aria-hidden className="h-4 w-4 shrink-0" />,
      summary: block.summarise(ops, now),
      content: (
        <BlockErrorBoundary title={block.meta.title}>{block.render(block.meta, ops, now)}</BlockErrorBoundary>
      ),
    };
  });

  return <ConfigurableGrid userId={userId} blocks={blocks} />;
}
