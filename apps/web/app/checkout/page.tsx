import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "../_content/i18n";
import { CheckoutAction } from "./CheckoutAction";

/**
 * Минимальный платёжный экран. Открывается из карточек тарифов на лендинге
 * (`/checkout?plan=free|pro`). Показывает выбранный план и его состав.
 *
 * TODO: подключить реального платёжного провайдера (Stripe/ЮKassa). Сейчас это
 * заглушка экрана оплаты — кнопка оплаты неактивна до интеграции биллинга.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planParam } = await searchParams;
  const copy = getDictionary().marketing;

  const requested = (planParam ?? "pro").toLowerCase();
  const plan = copy.pricing.find(([name]) => name.toLowerCase() === requested);
  if (!plan) notFound();
  const [name, price, features] = plan;
  const isFree = price.replace(/[^0-9]/g, "") === "0";

  return (
    <main className="landing-section checkout-screen">
      <div className="section-kicker">Checkout</div>
      <div className="checkout-grid">
        <div className="section-copy">
          <h2>Оформление подписки</h2>
          <p>
            Вы выбрали план <strong>{name}</strong>. {isFree
              ? "Проверьте состав и создайте аккаунт."
              : "Проверьте состав. Оплата временно недоступна, пока биллинг в разработке."}
          </p>
          <Link className="checkout-back" href="/#pricing">
            ← Назад к тарифам
          </Link>
        </div>

        <article className="price-card checkout-summary">
          <span>{name}</span>
          <strong>
            {price}
            <span className="checkout-period">{isFree ? "" : " / мес"}</span>
          </strong>
          <ul className="price-features">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          <CheckoutAction isFree={isFree} />
        </article>
      </div>
    </main>
  );
}
