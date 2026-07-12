"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NavbarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onToggleMobile: () => void;
}

export function Navbar({
  onToggleSidebar,
  onToggleMobile,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-zinc-200 bg-white px-4 lg:px-6">
      <button
        onClick={onToggleMobile}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 hover:bg-zinc-50 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <button
        onClick={onToggleSidebar}
        className="hidden h-9 w-9 items-center justify-center rounded-md border border-zinc-200 hover:bg-zinc-50 lg:flex"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={1.5} />
        <Input
          placeholder="Search..."
          className="pl-9 bg-zinc-50 border-transparent focus-visible:border-zinc-200"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </header>
  );
}
