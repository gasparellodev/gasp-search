import "server-only";

import { BanksStrip } from "../BanksStrip";

/**
 * Banks partners — wrapper Server Component que adiciona `<h2>` à
 * `<BanksStrip>` shared (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * Reuso da strip de bancos parceiros existente (#G2 / issue #219). A
 * strip por si só não tem heading semântico (é footer-friendly); este
 * componente adiciona contexto editorial pra Home.
 */
export function HomeBanksPartners() {
  return (
    <section
      id="bancos-parceiros"
      data-testid="home-banks-partners"
      data-reveal
      aria-label="Bancos parceiros"
      className="scroll-mt-24 w-full bg-background py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mb-8 flex flex-col gap-3 text-center md:mb-12">
          <h2 className="as-h2 text-foreground">
            Bancos parceiros para financiar seu próximo carro
          </h2>
          <p className="text-sm text-foreground/60 md:text-base">
            Trabalhamos com os principais bancos para encontrar a melhor taxa
            para o seu perfil.
          </p>
        </header>
        <BanksStrip />
      </div>
    </section>
  );
}
