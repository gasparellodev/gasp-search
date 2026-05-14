"use client";

import { useEffect } from "react";

import { loadGsap, prefersReducedMotion } from "@/lib/sites/motion";

/**
 * Side-effect Client Component (Phase 7 / WP7 — issue #296). Sem render
 * visível: ao montar, anima todos elementos `[data-reveal]` com fade+slide
 * via GSAP + ScrollTrigger conforme entram no viewport.
 *
 * **Decisões:**
 *   - Padrão fixo: `y: 32, opacity: 0 → 1, duration: 0.8s, stagger 0.1s` por
 *     grupo `[data-reveal]`. Cada section da home recebe o atributo e roda
 *     como uma timeline isolada (start `"top 80%"`).
 *   - `toggleActions: 'play none none none'` — anima uma vez, não reverte
 *     ao sair do viewport (UX premium, evita "blink" no scroll-up).
 *   - **`prefers-reduced-motion`**: NÃO chama `loadGsap`. Elementos
 *     ficam visíveis imediato (CSS já mostra; `data-reveal` é só anchor).
 *   - **Cleanup no unmount**: kill todos ScrollTriggers criados e limpa
 *     inline styles do GSAP em cada element pra evitar leak entre rotas.
 *
 * **Não conflita com sticky header** porque GSAP só anima `transform` /
 * `opacity` dos elementos `[data-reveal]` — o header glass-sticky e seu
 * sentinel `data-site-header-sentinel` continuam intactos.
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
        targets = els;

        for (const el of els) {
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
            triggers.push(tween.scrollTrigger as unknown as { kill: () => void });
          }
        }

        // Garante que tudo recalcule depois do paint inicial — fontes
        // assíncronas e imagens lazy podem mudar offsets.
        ScrollTrigger.refresh();
      })
      .catch(() => {
        // Falha no dynamic import: degradar graciosamente — sem animação.
        // Não logamos porque é UX cosmético, não erro de aplicação.
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
