"use client";

import { useEffect } from "react";

import { loadGsap, prefersReducedMotion } from "@/lib/sites/motion";

type RevealVariant = "hero-image" | "hero-card" | "hero-cta-stagger";

const KNOWN_VARIANTS = new Set<RevealVariant>([
  "hero-image",
  "hero-card",
  "hero-cta-stagger",
]);

function readVariant(el: HTMLElement): RevealVariant | null {
  const raw = el.dataset.revealVariant;
  if (!raw) return null;
  return KNOWN_VARIANTS.has(raw as RevealVariant)
    ? (raw as RevealVariant)
    : null;
}

/**
 * Side-effect Client Component (Phase 7 / WP7 #296 + WP2 #310).
 *
 * Sem render visível: ao montar, anima elementos `[data-reveal]` via GSAP.
 *
 * **Variants (WP2 #310):**
 *   - Sem `data-reveal-variant`: comportamento legado WP7 — `y:32, opacity:0→1`
 *     com `ScrollTrigger` no viewport (toggleActions `play none none none`).
 *   - `data-reveal-variant="hero-image"`: fade + scale 1.0→1.05 imediato no
 *     mount (sem scrollTrigger). Ken-burns lite — imagem fica viva.
 *   - `data-reveal-variant="hero-card"`: slide-up + scale 0.96→1.0 imediato.
 *     Card glass do Hero entra com peso.
 *   - `data-reveal-variant="hero-cta-stagger"`: stagger nos filhos diretos
 *     (`y:12, opacity:0→1`, stagger 0.08s, delay 0.6s).
 *
 * **`prefers-reduced-motion`**: early return — todos variants viram no-op.
 * Elementos ficam visíveis estáticos (CSS já mostra; `data-reveal` é só anchor).
 *
 * **Cleanup no unmount**: kill todos ScrollTriggers + limpa inline styles
 * pra evitar leak entre rotas.
 */
export function HomeMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let triggers: Array<{ kill: () => void }> = [];
    let targets: HTMLElement[] = [];

    loadGsap()
      .then(({ gsap, ScrollTrigger }) => {
        if (cancelled) return;
        const els = Array.from(
          document.querySelectorAll<HTMLElement>("[data-reveal]"),
        );
        // `targets` é um NOVO array (não alias de els) — evita mutação
        // durante a iteração quando hero-cta-stagger empurra os filhos
        // pra cleanup.
        targets = [...els];

        for (const el of els) {
          const variant = readVariant(el);

          if (variant === "hero-image") {
            gsap.fromTo(
              el,
              { scale: 1.0, opacity: 0 },
              {
                scale: 1.05,
                opacity: 1,
                duration: 1.2,
                ease: "power2.out",
              },
            );
            continue;
          }

          if (variant === "hero-card") {
            gsap.from(el, {
              y: 48,
              opacity: 0,
              scale: 0.96,
              duration: 0.9,
              delay: 0.2,
              ease: "power3.out",
            });
            continue;
          }

          if (variant === "hero-cta-stagger") {
            const children = Array.from(el.children) as HTMLElement[];
            if (children.length > 0) {
              gsap.from(children, {
                y: 12,
                opacity: 0,
                stagger: 0.08,
                delay: 0.6,
                duration: 0.5,
                ease: "power2.out",
              });
              targets.push(...children);
            }
            continue;
          }

          // Default (WP7): scrollTrigger fade-up.
          const tween = gsap.from(el, {
            y: 32,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          });
          if (tween.scrollTrigger) {
            triggers.push(
              tween.scrollTrigger as unknown as { kill: () => void },
            );
          }
        }

        // Garante recalculo após paint inicial (fontes async, lazy images).
        ScrollTrigger.refresh();
      })
      .catch(() => {
        // Falha no dynamic import: degradar graciosamente — sem animação.
      });

    return () => {
      cancelled = true;
      for (const trigger of triggers) {
        trigger.kill();
      }
      triggers = [];
      for (const el of targets) {
        el.style.transform = "";
        el.style.opacity = "";
      }
      targets = [];
    };
  }, []);

  return null;
}
