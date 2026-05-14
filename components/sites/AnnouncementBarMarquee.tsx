"use client";

import { useEffect, useRef } from "react";

import { loadAnime, prefersReducedMotion } from "@/lib/sites/motion";

interface AnnouncementBarMarqueeProps {
  /** Texto já sanitizado (passa pelo `sanitizeAnnouncementText` upstream). */
  text: string;
}

/**
 * Quantas cópias do texto entram no track. 4 garante que o track tenha
 * largura ≥ 2× o viewport mesmo em telas grandes com strings curtas,
 * dando margem pra animar `-50%` em loop sem gap visível.
 */
const REPEAT = 4;

/**
 * Duração em ms pra varrer o track inteiro (de 0% a -50%). 18s por ciclo
 * dá leitura tranquila + sensação premium (não passa rápido demais).
 */
const SCROLL_DURATION_MS = 18000;

/**
 * Marquee infinito horizontal do `<AnnouncementBar>` (Phase 7 / WP2 — #291).
 *
 * Estratégia:
 *   - Duplica o texto `REPEAT` vezes no track.
 *   - Anima `translateX` de `0%` → `-50%` em loop infinito linear via
 *     anime.js v4 (consome `loadAnime()` do motion helper #290).
 *   - O ponto exato `-50%` cria a sensação de loop perfeito porque o
 *     segundo bloco do track começa exatamente onde o primeiro acabou.
 *   - Respeita `prefers-reduced-motion`: quando `reduce`, renderiza o
 *     texto centralizado estático, **sem** disparar o `loadAnime` (poupa
 *     bundle dinâmico em dispositivos que pediram quietude).
 *
 * Cleanup: a animação é cancelada no unmount via `controls.pause()` +
 * remove `transform` inline pra evitar leak entre rotas.
 */
export function AnnouncementBarMarquee({
  text,
}: AnnouncementBarMarqueeProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const track = trackRef.current;
    if (!track) return;

    let cancelled = false;
    let controls: { pause: () => void } | null = null;

    loadAnime()
      .then((mod) => {
        if (cancelled || !track) return;
        const instance = mod.animate(track, {
          translateX: ["0%", "-50%"],
          duration: SCROLL_DURATION_MS,
          ease: "linear",
          loop: true,
        });
        // anime.js v4 retorna um controller com `pause()`/`play()` etc.
        // Tipamos como mínimo necessário pra cleanup sem amarrar contrato.
        controls = instance as unknown as { pause: () => void };
      })
      .catch(() => {
        // Falha ao carregar anime.js: degradar graciosamente — track fica
        // estático. Console silencioso porque é UX cosmético, não erro.
      });

    return () => {
      cancelled = true;
      controls?.pause();
      if (track) {
        track.style.transform = "";
      }
    };
  }, [text]);

  // Quando reduce-motion, render estático centralizado, sem track-x-2.
  // Avaliação só executa no client; durante SSR rendezirá o track normal —
  // o useEffect (no client) decide se anima. Sem flash porque o track
  // duplicado também aparece "rolado" em 0%, exibindo o texto de qualquer
  // jeito.
  const items = Array.from({ length: REPEAT }, (_, i) => i);

  return (
    <div
      data-testid="announcement-bar-marquee"
      className="relative w-full overflow-hidden whitespace-nowrap"
    >
      <div
        ref={trackRef}
        className="inline-flex items-center gap-x-8 will-change-transform"
        // `aria-hidden` no track: leitores de tela já têm o conteúdo via
        // `<span>` sr-only abaixo (anúncio único, não 4x).
        aria-hidden="true"
      >
        {items.map((i) => (
          <span
            key={i}
            className="inline-flex shrink-0 items-center gap-x-8 text-sm font-medium"
          >
            <span>{text}</span>
            <span aria-hidden="true">•</span>
          </span>
        ))}
      </div>
      <span className="sr-only">{text}</span>
    </div>
  );
}
