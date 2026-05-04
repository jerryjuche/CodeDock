import { cn } from "@/lib/utils";

export default function RoomSourceBadge({
  sourceType,
}: {
  sourceType: string;
}) {
  const label =
    sourceType === "github_repo"
      ? "GitHub repo"
      : sourceType === "local_workspace"
        ? "Local workspace"
        : sourceType;

  const tone =
    sourceType === "github_repo"
      ? "bg-[rgba(36,166,242,0.16)] text-[rgb(47,203,255)]"
      : "bg-[rgba(239,102,46,0.16)] text-[rgb(249,145,53)]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}