import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  tone?: "light" | "dark";
  /** Font-size in tailwind text-* class. Defaults to text-2xl. */
  size?: string;
};

/**
 * Leaderei wordmark — official brand lockup.
 * Renders "leaderei" in lowercase using the Ibrand typeface (brandbook).
 * Never combine with a separate icon/mark.
 */
export function Logo({ className, tone = "dark", size = "text-2xl" }: LogoProps) {
  const color = tone === "dark" ? "text-foreground" : "text-white";
  return (
    <span
      className={cn(
        "inline-block font-brand leading-none tracking-tight select-none",
        size,
        color,
        className,
      )}
      aria-label="Leaderei"
    >
      leaderei
    </span>
  );
}

/**
 * Compact mark for tight spaces (favicons, collapsed sidebar, avatars).
 * Uses the first letter of the wordmark in the brand typeface, on a brand-color tile.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-foreground font-brand text-lg leading-none",
        className,
      )}
      aria-hidden
    >
      l
    </span>
  );
}
