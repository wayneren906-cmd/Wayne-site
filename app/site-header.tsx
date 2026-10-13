"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const navigation = [
  { id: "home", href: "/", label: "Index" },
  { id: "learning", href: "/learning", label: "Journal" },
  { id: "studio", href: "/studio", label: "Studio" },
];

export default function SiteHeader({ active }: { active: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("journal-theme");
    } catch {
      /* Storage may be unavailable in some environments. */
    }
    const value = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const value = !dark;
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
    try {
      localStorage.setItem("journal-theme", value ? "dark" : "light");
    } catch {
      /* Keep theme state for active tab. */
    }
  }

  return (
    <header className="editorial-nav-bar" role="banner">
      <div className="brand-anchor">
        <a className="wordmark-wrap" href="/" aria-label="wayneo 首页">
          <img src="/wayneo-logo-clean.png" alt="wayneo" width={1448} height={1086} />
        </a>
        <span className="nav-edition-tag" aria-hidden="true">
          [ VOL. 2026 ]
        </span>
      </div>

      <nav className="nav-links-cluster" aria-label="主站导航">
        {navigation.map((item) => (
          <a
            key={item.id}
            href={item.href}
            aria-current={active === item.id ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={dark ? "切换至浅色日间纸本" : "切换至深色暗室模式"}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </nav>
    </header>
  );
}
