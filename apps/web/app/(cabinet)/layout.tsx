import Link from "next/link";

const navigation = [
  { href: "/dashboard", label: "dashboard" },
  { href: "/reviews", label: "reviews" },
  { href: "/problems", label: "problems" },
  { href: "/roadmap", label: "roadmap" },
  { href: "/patterns", label: "patterns" },
  { href: "/cards", label: "cards" },
  { href: "/extension", label: "extension" },
  { href: "/settings", label: "settings" },
];

export default function CabinetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="cabinet-shell">
      <aside className="cabinet-sidebar">
        <Link className="site-brand" href="/">
          Engram
        </Link>
        <nav className="cabinet-nav" aria-label="Personal cabinet">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="cabinet-sidebar__note">
          <span>mock mode</span>
          <p>Кабинет работает на моках: backend API пока не подключаем.</p>
        </div>
      </aside>

      <div className="cabinet-main">
        <header className="cabinet-topbar">
          <div>
            <span>// personal memory layer</span>
            <strong>Backend SWE · interview in 21 days</strong>
          </div>
          <Link className="cabinet-topbar__link" href="/">
            back to marketing
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
