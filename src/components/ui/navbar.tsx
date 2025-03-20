import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Top Users" },
  { href: "/posts?type=latest", label: "Latest Posts" },
  { href: "/posts?type=popular", label: "Popular Posts" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-primary-600">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="text-white font-bold text-lg">
              Social Media Analytics
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href.split("?")[0]);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      isActive
                        ? "bg-primary-700 text-white"
                        : "text-white hover:bg-primary-500",
                      "px-3 py-2 rounded-md text-sm font-medium"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
