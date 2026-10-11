"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const navigation = [
  { id: "home", href: "/", label: "首页" },
  { id: "learning", href: "/learning", label: "学习记录" },
  { id: "projects", href: "/projects", label: "项目" },
];

export default function SiteHeader({ active }: { active: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("journal-theme"); } catch { /* Storage may be unavailable in an embedded viewer. */ }
    const value = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);
  function toggleTheme() {
    const value = !dark;
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
    try { localStorage.setItem("journal-theme", value ? "dark" : "light"); } catch { /* Keep the selected theme for this page. */ }
  }
  return <header className="topbar personal-topbar">
    <a className="brand personal-brand" href="/" aria-label="Wayneo 的个人网站首页"><span className="wordmark"><img src="/wayneo-logo.png" alt="wayneo" width={1448} height={1086}/></span></a>
    <div className="nav-actions"><nav className="site-nav" aria-label="主导航">{navigation.map(item => <a key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>{item.label}</a>)}</nav><button type="button" className="icon-button" onClick={toggleTheme} aria-label={dark ? "切换浅色模式" : "切换深色模式"}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
  </header>;
}
