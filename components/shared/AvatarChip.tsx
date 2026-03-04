import { User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AvatarChipProps {
  user: User | null | undefined;
  size?: "sm" | "md";
  showName?: boolean;
  className?: string;
}

export function AvatarChip({
  user,
  size = "md",
  showName = false,
  className,
}: AvatarChipProps) {
  // Defensive: if user is null/undefined, render the unassigned placeholder
  if (!user) {
    return <UnassignedChip size={size} />;
  }

  const sizeClass = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
          sizeClass,
        )}
        style={{ backgroundColor: user.avatarColor ?? "#94a3b8" }}
        title={user.name ?? ""}
      >
        {user.initials ?? "?"}
      </span>
      {showName && (
        <span className="text-sm text-foreground">
          {user.name ?? "Unknown"}
        </span>
      )}
    </span>
  );
}

export function UnassignedChip({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-500 font-medium shrink-0",
        sizeClass,
      )}
      title="Unassigned"
    >
      ?
    </span>
  );
}
