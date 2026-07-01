import { classNames, cssLength, type CSSLength, type CSSVariableStyle } from "./utils";

export type SkeletonVariant = "text" | "block" | "card" | "list";

/**
 * Скелетон-заглушка с вариантами для текста, блока, карточки и списка.
 * Анимация shimmer отключается в CSS через `prefers-reduced-motion`.
 */
export function Skeleton({
  variant = "text",
  count,
  lines,
  width,
  height,
  radius,
  ariaLabel = "Загрузка",
  decorative = false,
  className,
}: Readonly<{
  variant?: SkeletonVariant;
  count?: number;
  lines?: number;
  width?: CSSLength;
  height?: CSSLength;
  radius?: CSSLength;
  ariaLabel?: string;
  decorative?: boolean;
  className?: string;
}>) {
  const unitCount = normalizeCount(count, variant === "list" ? 3 : 1);
  const lineCount = normalizeCount(lines, variant === "text" ? 3 : 2);
  const style = skeletonStyle({ width, height, radius });

  return (
    <div
      className={classNames("ui-skeleton", `ui-skeleton--${variant}`, className)}
      style={style}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-busy={decorative ? undefined : true}
      aria-hidden={decorative ? true : undefined}
    >
      <div className="ui-skeleton__content" aria-hidden="true">
        {Array.from({ length: unitCount }, (_, index) => (
          <SkeletonUnit key={`${variant}-${index}`} variant={variant} lines={lineCount} />
        ))}
      </div>
    </div>
  );
}

function SkeletonUnit({
  variant,
  lines,
}: Readonly<{
  variant: SkeletonVariant;
  lines: number;
}>) {
  if (variant === "block") {
    return <span className="ui-skeleton__block ui-skeleton__shimmer" />;
  }

  if (variant === "card") {
    return (
      <article className="ui-skeleton__card">
        <div className="ui-skeleton__card-head">
          <span className="ui-skeleton__avatar ui-skeleton__shimmer" />
          <SkeletonLines lines={Math.max(1, Math.min(lines, 2))} />
        </div>
        <span className="ui-skeleton__block ui-skeleton__shimmer" />
      </article>
    );
  }

  if (variant === "list") {
    return (
      <div className="ui-skeleton__row">
        <span className="ui-skeleton__dot ui-skeleton__shimmer" />
        <SkeletonLines lines={Math.max(1, Math.min(lines, 3))} />
      </div>
    );
  }

  return <SkeletonLines lines={lines} />;
}

function SkeletonLines({ lines }: Readonly<{ lines: number }>) {
  return (
    <div className="ui-skeleton__lines">
      {Array.from({ length: lines }, (_, index) => (
        <span className="ui-skeleton__line ui-skeleton__shimmer" key={`line-${index}`} />
      ))}
    </div>
  );
}

function normalizeCount(value: number | undefined, fallback: number) {
  const next = value ?? fallback;
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.floor(next));
}

function skeletonStyle({
  width,
  height,
  radius,
}: Readonly<{
  width?: CSSLength;
  height?: CSSLength;
  radius?: CSSLength;
}>) {
  const style: CSSVariableStyle = {};
  const nextWidth = cssLength(width);
  const nextHeight = cssLength(height);
  const nextRadius = cssLength(radius);

  if (nextWidth) style["--ui-skeleton-width"] = nextWidth;
  if (nextHeight) style["--ui-skeleton-height"] = nextHeight;
  if (nextRadius) style["--ui-skeleton-radius"] = nextRadius;

  return Object.keys(style).length > 0 ? style : undefined;
}
