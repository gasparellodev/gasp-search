import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

interface TopbarProps {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Topbar é Server Component — recebe dados do user via props vindos
 * do layout `(app)/layout.tsx`. ThemeToggle e UserMenu são Client.
 */
export function Topbar({ email, name, avatarUrl }: TopbarProps) {
  return (
    <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b px-6 backdrop-blur">
      <ThemeToggle />
      <UserMenu email={email} name={name} avatarUrl={avatarUrl} />
    </header>
  );
}
