import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, Navigate } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  if (error.message === "Unauthorized") {
    const dest =
      typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
    return <Navigate to="/login" search={{ redirect: dest }} />;
  }

  const missing = error.message === "League not found";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-loss" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl">
        {missing ? "That league isn't here" : "Something went wrong"}
      </h1>
      <p className="max-w-md text-sm break-words text-muted">
        {missing
          ? "It may have been wiped or you're on a different desk. Sign in and pick a league from home."
          : error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
      {missing ? (
        <Link to="/" className="mt-2 text-sm text-muted hover:text-fg">
          Back to the desk
        </Link>
      ) : null}
    </main>
  );
}
