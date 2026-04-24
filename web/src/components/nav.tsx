"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const path = usePathname();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/bots" className="text-xl font-bold text-gray-900">
              Bottery
            </Link>
            <div className="flex gap-4">
              <Link
                href="/bots"
                className={`text-sm font-medium ${
                  path === "/bots"
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/bots/new"
                className={`text-sm font-medium ${
                  path === "/bots/new"
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Create Bot
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
