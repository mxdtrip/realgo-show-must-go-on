"use client";

import Link from "next/link";
import { useState } from "react";

// MVP payment stub: no real billing yet. The button gives an honest, friendly
// confirmation instead of a dead disabled control, and surfaces a success state
// so the flow reads end-to-end.
export function CheckoutAction({ isFree }: { isFree: boolean }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="checkout-done" role="status" aria-live="polite">
        <strong>{isFree ? "Бесплатный план активен" : "Выбор сохранён ✓"}</strong>
        <span>
          Платёжный провайдер появится позже — мы сообщим, когда оплата заработает. Биллинг
          пока в разработке.
        </span>
      </div>
    );
  }

  return (
    <>
      <button className="price-cta checkout-pay" type="button" onClick={() => setDone(true)}>
        {isFree ? "Начать бесплатно" : "Перейти к оплате"}
      </button>
      <p className="checkout-note">Демо-режим: реальная оплата подключится позже.</p>
      {!isFree ? (
        <p className="checkout-note">
          Оплачивая тариф Pro, вы принимаете условия{" "}
          <Link href="/offer" target="_blank">
            Публичной оферты
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
