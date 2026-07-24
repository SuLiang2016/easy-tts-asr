import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "relative w-full rounded-lg border p-4 text-sm",
        variant === "destructive"
          ? "border-destructive/50 text-destructive dark:border-destructive"
          : "border-border bg-muted text-foreground",
        className
      )}
      {...props}
    />
  );
}
