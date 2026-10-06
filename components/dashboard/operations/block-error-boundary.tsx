"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Isolates one dashboard block: a render failure here never takes down the page. */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[dashboard] "${this.props.title}" block failed to render`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-xs text-destructive">
        <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <p className="font-semibold">{this.props.title}</p>
          <p className="mt-0.5 text-muted-foreground">This block couldn&apos;t be displayed. The rest of the dashboard is unaffected.</p>
        </div>
      </div>
    );
  }
}
