import { classNames, cssLength, type CSSVariableStyle } from "./utils";

export type SpinnerSize = "sm" | "md" | "lg" | number;

/**
 * Кольцевой индикатор загрузки. По умолчанию объявляет `role="status"`;
 * для декоративного использования передайте `decorative`.
 */
export function Spinner({
  size = "md",
  label = "Загрузка",
  decorative = false,
  className,
}: Readonly<{
  size?: SpinnerSize;
  label?: string;
  decorative?: boolean;
  className?: string;
}>) {
  const isPreset = size === "sm" || size === "md" || size === "lg";
  const preset = isPreset ? size : "custom";
  const style = isPreset ? undefined : spinnerStyle(size);

  return (
    <span
      className={classNames("ui-spinner", `ui-spinner--${preset}`, className)}
      style={style}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    />
  );
}

function spinnerStyle(size: number) {
  const style: CSSVariableStyle = {
    "--ui-spinner-size": cssLength(size),
  };

  return style;
}
