"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export function InstanceBanner() {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/whatsapp/instance", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { status: string }) => {
        if (active) setStatus(body.status);
      })
      .catch(() => {
        /* fallback: deixa null e UI esconde o banner */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!status || status === "connected") return null;

  return (
    <div
      className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
      data-testid="instance-banner"
    >
      <TriangleAlert className="size-4 shrink-0" />
      <span>
        WhatsApp não está conectado.{" "}
        <Link href="/settings" className="underline">
          Conectar agora
        </Link>
      </span>
    </div>
  );
}
