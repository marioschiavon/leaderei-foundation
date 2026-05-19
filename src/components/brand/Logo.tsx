import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  variant?: "full" | "mark";
  tone?: "light" | "dark";
};

export function Logo({ className, variant = "full", tone = "dark" }: LogoProps) {
  const text = tone === "dark" ? "text-foreground" : "text-white";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {variant === "full" && (
        <span
          className={cn(
            "font-display text-[1.05rem] font-extrabold tracking-tight",
            text,
          )}
        >
          Leader<span className="text-brand">ei</span>
        </span>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-foreground shadow-sm",
        className,
      )}
      aria-hidden
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 2v10h10"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="square"
        />
      </svg>
    </div>
  );
}
