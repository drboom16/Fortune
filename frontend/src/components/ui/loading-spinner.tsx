import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  label?: string;
  sublabel?: string;
  className?: string;
}

export function LoadingSpinner({ label, sublabel = "Loading…", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-col items-center justify-center gap-4",
        className
      )}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {sublabel && <p className="text-sm text-muted-foreground">{sublabel}</p>}
    </div>
  );
}
