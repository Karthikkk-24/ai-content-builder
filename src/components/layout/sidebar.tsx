"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  FileText,
  Image,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  Settings,
  Sparkles,
  User,
  Wand2,
  Type,
  Captions,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/builder", label: "Content Builder", icon: FileText },
];

const aiGeneratorItems = [
  { href: "/generate/posters", label: "Posters", icon: Image },
  { href: "/generate/tweets", label: "Tweets", icon: MessageSquare },
  { href: "/generate/photos", label: "Photo Generator", icon: Sparkles },
  { href: "/generate/prompt-upgrade", label: "Prompt Upgrade", icon: Wand2 },
  { href: "/generate/blog", label: "Blog Outline", icon: PenLine },
  { href: "/generate/captions", label: "Social Captions", icon: Captions },
];

const bottomNavItems = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(
    pathname.startsWith("/generate")
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-zinc-200 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center border border-zinc-900">
              <Type className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight">ContentAI</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center border border-zinc-900">
              <Type className="h-4 w-4" strokeWidth={1.5} />
            </div>
          </Link>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-zinc-900" />
              )}
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <div className="pt-2">
          {collapsed ? (
            <Link
              href="/generate"
              onClick={onMobileClose}
              className={cn(
                "flex w-full items-center justify-center rounded-md px-3 py-2.5 text-sm transition-colors",
                pathname.startsWith("/generate")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
              aria-label="AI Generator"
            >
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            </Link>
          ) : (
            <button
              onClick={() => setAiOpen(!aiOpen)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                pathname.startsWith("/generate")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-left">AI Generator</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  aiOpen && "rotate-180"
                )}
                strokeWidth={1.5}
              />
            </button>
          )}

          <AnimatePresence initial={false}>
            {aiOpen && !collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="ml-4 space-y-0.5 border-l border-zinc-200 py-1 pl-3">
                  <Link
                    href="/generate"
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      pathname === "/generate"
                        ? "text-zinc-900 font-medium"
                        : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>All tools</span>
                  </Link>
                  {aiGeneratorItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onMobileClose}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "text-zinc-900 font-medium"
                            : "text-zinc-500 hover:text-zinc-900"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="my-3 border-t border-zinc-200" />

        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-zinc-900" />
              )}
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          width: collapsed ? 64 : 256,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "fixed left-0 top-0 z-50 hidden h-screen border-r border-zinc-200 bg-white lg:block"
        )}
      >
        {sidebarContent}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-zinc-200 bg-white lg:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
