import "server-only";

import { Camera, ClipboardCheck, MessageCircle } from "lucide-react";

const STEPS = [
  {
    title: "Envie os dados",
    body: "Informe modelo, ano, quilometragem e contatos para a avaliação inicial.",
    Icon: ClipboardCheck,
  },
  {
    title: "Adicione fotos",
    body: "Inclua ao menos duas fotos nítidas, sem placa visível, para acelerar a análise.",
    Icon: Camera,
  },
  {
    title: "Receba retorno",
    body: "A loja entra em contato com uma proposta ou próximos passos de vistoria.",
    Icon: MessageCircle,
  },
] as const;

export function AnnounceProcessExplanation() {
  return (
    <section data-testid="announce-process-explanation" className="bg-foreground/[0.02] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <h2 className="text-3xl font-bold text-foreground md:text-4xl">
          Como funciona a avaliação
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-site-feature border border-foreground/10 bg-background p-6">
              <Icon className="size-6 text-foreground/70" aria-hidden="true" />
              <h3 className="mt-5 text-xl font-semibold text-foreground">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground/70 md:text-base">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
