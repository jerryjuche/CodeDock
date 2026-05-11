import Image from "next/image";
import { cn } from "@/lib/utils";

export default function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <Image
        src="/brand/codedock-logo.png"
        alt="CodeDock"
        width={420}
        height={100}
        priority={priority}
        className="h-auto w-[140px] sm:w-[160px] lg:w-[180px]"
      />
    </div>
  );
}
