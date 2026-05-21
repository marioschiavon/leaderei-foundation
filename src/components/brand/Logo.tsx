import { cn } from "@/lib/utils";
import logoColor from "@/assets/brand/leaderei-color.png";
import logoWhite from "@/assets/brand/leaderei-white.png";
import logoBlack from "@/assets/brand/leaderei-black.png";
import logoGray from "@/assets/brand/leaderei-gray.png";

type Variant = "color" | "white" | "black" | "gray";

type LogoProps = {
  className?: string;
  /** "dark" = sobre fundo claro (usa laranja). "light" = sobre fundo escuro (usa branco). */
  tone?: "light" | "dark";
  /** Força uma variante específica, sobrescrevendo `tone`. */
  variant?: Variant;
  /** Classe de altura tailwind. Ex.: "h-7", "h-8", "h-10". Default "h-7". */
  size?: string;
};

const SRC: Record<Variant, string> = {
  color: logoColor,
  white: logoWhite,
  black: logoBlack,
  gray: logoGray,
};

/**
 * Leaderei wordmark — official brand lockup (image asset).
 */
export function Logo({ className, tone = "dark", variant, size = "h-7" }: LogoProps) {
  const v: Variant = variant ?? (tone === "light" ? "white" : "color");
  return (
    <img
      src={SRC[v]}
      alt="Leaderei"
      className={cn("w-auto select-none object-contain text-left", size, className)}
      draggable={false}
    />
  );
}

/**
 * Compact mark for tight spaces (collapsed sidebar, avatars).
 * Reuses the wordmark cropped via container — keeps brand consistency.
 */
export function LogoMark({
  className,
  tone = "dark",
  variant,
}: {
  className?: string;
  tone?: "light" | "dark";
  variant?: Variant;
}) {
  const v: Variant = variant ?? (tone === "light" ? "white" : "color");
  return (
    <span
      className={cn(
        "inline-grid h-7 w-7 place-items-center overflow-hidden rounded-md",
        className,
      )}
      aria-hidden
    >
      <img
        src={SRC[v]}
        alt=""
        className="h-4 w-auto max-w-none -translate-x-[2%] object-contain"
        draggable={false}
      />
    </span>
  );
}
