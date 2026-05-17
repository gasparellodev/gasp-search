"use client";

import { ChevronDown } from "lucide-react";
import { Accordion } from "radix-ui";

import { cn } from "@/lib/utils";

export interface SiteFAQItem {
  question: string;
  answer: string;
}

interface SiteFAQProps {
  title: string;
  items: readonly SiteFAQItem[];
  eyebrow?: string;
  className?: string;
  testId?: string;
}

/**
 * Shared FAQ accordion for public site pages.
 *
 * Intentionally does not emit FAQPage JSON-LD. The Site Generator keeps FAQ
 * content as visible UX only; structured data for FAQ is avoided by product
 * policy because Google restricted FAQ rich results for business sites.
 */
export function SiteFAQ({
  title,
  items,
  eyebrow = "FAQ",
  className,
  testId = "site-faq",
}: SiteFAQProps) {
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className={cn("w-full bg-background py-16 md:py-24", className)}
    >
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <header className="mb-10 flex flex-col gap-3 text-center md:mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60"
            aria-hidden="true"
          >
            {eyebrow}
          </p>
          <h2 className="as-h2 text-foreground">
            {title}
          </h2>
        </header>

        <Accordion.Root
          type="single"
          collapsible
          className="flex flex-col gap-2"
        >
          {items.map((entry, idx) => {
            const value = `faq-${idx}`;
            return (
              <Accordion.Item
                key={`${entry.question}-${idx}`}
                value={value}
                className="overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.02]"
              >
                <Accordion.Header>
                  <Accordion.Trigger
                    className={cn(
                      "group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-foreground transition-colors hover:bg-foreground/[0.04] md:px-6 md:py-5 md:text-lg",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                    )}
                  >
                    <span>{entry.question}</span>
                    <ChevronDown
                      className="size-5 shrink-0 text-foreground/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden text-sm text-foreground/75 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down md:text-base">
                  <div className="px-5 pb-5 md:px-6 md:pb-6">
                    {entry.answer}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      </div>
    </section>
  );
}
