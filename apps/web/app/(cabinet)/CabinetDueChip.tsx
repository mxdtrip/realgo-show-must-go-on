"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getReviewQueue } from "../_api/reviews";

/** Живой счётчик «due today» в топбаре. До ответа API (и при ошибке) чип
    показывает только подпись — число не выдумываем. */
export function CabinetDueChip({ label }: Readonly<{ label: string }>) {
  const [count, setCount] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getReviewQueue(controller.signal)
      .then((response) => setCount(`${response.data.length}${response.meta?.nextCursor ? "+" : ""}`))
      .catch(() => {
        // Молча: чип остаётся без числа.
      });
    return () => controller.abort();
  }, []);

  return (
    <Link className="cabinet-due-chip" data-tour="due" href="/reviews">
      {count !== null ? `${count} ${label}` : label}
    </Link>
  );
}
