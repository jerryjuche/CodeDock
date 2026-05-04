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
        height={140}
        priority={priority}
        className="h-auto w-[150px] sm:w-[175px] lg:w-[195px]"
      />
    </div>
  );
}