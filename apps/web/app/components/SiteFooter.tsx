"use client";

import { usePathname } from "next/navigation";
import { getDictionary } from "../_content/i18n";

export function SiteFooter() {
  const dictionary = getDictionary();
  const copy = dictionary.marketing;
  const pathname = usePathname();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner" data-reveal="fade">
        <div className="site-footer__brand">
          <a className="site-brand" href="/">
            {dictionary.common.brand}
          </a>
          <p>{copy.footer.description}</p>
        </div>
        {copy.footer.columns.map((column) => (
          <nav className="footer-col" key={column.title}>
            <h4>{column.title}</h4>
            {column.links.map((link) => {
              const isExternal = link.href.startsWith("http");
              const isCurrent = !isExternal && link.href === pathname;
              return (
                <a
                  href={link.href}
                  key={link.label}
                  aria-current={isCurrent ? "page" : undefined}
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        ))}
      </div>
      <div className="site-footer__bar">
        <span>{copy.footer.copyright}</span>
        <span className="footer-powered">
          {copy.footer.poweredBy}
          <img
            src="/author-tag.png"
            alt=""
            className="footer-powered__logo"
            decoding="async"
            height="1024"
            loading="lazy"
            width="1024"
          />
        </span>
        <span>{copy.footer.tagline}</span>
      </div>
    </footer>
  );
}
