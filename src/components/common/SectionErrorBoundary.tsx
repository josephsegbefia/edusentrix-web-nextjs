"use client";
import React, { GetDerivedStateFromError } from "react";
import { Button } from "../ui/button";

type State = { hasError: boolean };
export class SectionErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { hasError: false };
  static GetDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_e: unknown) {
    console.log(_e);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
        <div className="font-medium text-rose-200">Something went wrong</div>
        <div className="text-rose-300/80 text-sm mt-1">
          This section is not available right now. Please try again later.
        </div>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => this.setState({ hasError: false })}
        >
          Retry
        </Button>
      </div>
    );
  }
}
