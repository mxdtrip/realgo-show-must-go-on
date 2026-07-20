"use client";

import Link from "next/link";

// Billing is not connected yet, so this control must never claim that a plan
// was activated or persisted. Free users can continue to real registration;
// paid checkout stays visibly unavailable until a real API exists.
export function CheckoutAction({ isFree }: { isFree: boolean }) {
  if (isFree) {
    return (
      <Link className="price-cta checkout-pay" href="/register">
        Создать бесплатный аккаунт
      </Link>
    );
  }

  return (
    <>
      <button className="price-cta checkout-pay" type="button" disabled>
        Оплата временно недоступна
      </button>
      <p className="checkout-note">Биллинг в разработке; выбор тарифа сейчас не сохраняется.</p>
      <p className="checkout-note">
        После запуска оплаты будут действовать условия{" "}
        <Link href="/offer" target="_blank">
          Публичной оферты
        </Link>
        .
      </p>
    </>
  );
}
