"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  Kanban,
  MessagesSquare,
  Send,
  Settings,
  Menu,
} from "lucide-react";
import { publicEnv } from "@/lib/env-public";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BASE_NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Buscar", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const WHATSAPP_NAV_ITEMS: readonly NavItem[] = [
  { href: "/messages", label: "Mensagens", icon: MessagesSquare },
  { href: "/campaigns", label: "Campanhas", icon: Send },
];

// Insere itens de WhatsApp logo antes de Configurações quando habilitado.
function buildNavItems(): readonly NavItem[] {
  if (publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") return BASE_NAV_ITEMS;
  const settingsIndex = BASE_NAV_ITEMS.findIndex(
    (item) => item.href === "/settings",
  );
  return [
    ...BASE_NAV_ITEMS.slice(0, settingsIndex),
    ...WHATSAPP_NAV_ITEMS,
    ...BASE_NAV_ITEMS.slice(settingsIndex),
  ];
}

export const NAV_ITEMS: readonly NavItem[] = buildNavItems();

function NavLinks({
  pathname,
  closeOnNavigate = false,
}: {
  pathname: string;
  closeOnNavigate?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const link = (
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );

        return closeOnNavigate ? (
          <SheetClose asChild key={href}>
            {link}
          </SheetClose>
        ) : (
          <div key={href}>{link}</div>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Abrir menu principal"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))]">
        <SheetHeader className="border-b px-6 py-5">
          <p className="text-primary text-xs font-medium tracking-wider uppercase">
            GaspLab
          </p>
          <SheetTitle>Navegação principal</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-3 py-4">
          <NavLinks pathname={pathname} closeOnNavigate />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navegação principal"
      className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden h-full w-60 flex-shrink-0 border-r md:flex md:flex-col"
    >
      <div className="px-6 pt-6 pb-4">
        <p className="text-primary text-xs font-medium tracking-wider uppercase">
          GaspLab
        </p>
        <h2 className="text-lg font-semibold tracking-tight">Gasp Search</h2>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="flex-1 px-3 py-4">
        <NavLinks pathname={pathname} />
      </ScrollArea>
    </aside>
  );
}
