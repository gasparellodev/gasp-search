import "server-only";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { SitePage } from "@/components/sites/SitePage";
import { resolveVisualIdentity } from "@/lib/sites/default-visual-identity";
import { getSite } from "@/lib/sites/get-site";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const NOINDEX_FALLBACK: Metadata = {
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) return NOINDEX_FALLBACK;
  if (site.status === "draft" || site.status === "archived") {
    return NOINDEX_FALLBACK;
  }
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) return NOINDEX_FALLBACK;

  return {
    title: `Política de Privacidade — ${parsed.data.business_name}`,
    robots: { index: false, follow: false },
  };
}

export default async function LgpdPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:lgpd] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  const variables = parsed.data;
  const contactEmail = variables.email ?? "contato@gasplab.com";

  return (
    <SitePage
      variables={variables}
      siteId={site.id}
      slug={site.slug}
      activePage="lgpd"
      manifest={resolveVisualIdentity(site.visual_identity)}
    >
      <article className="mx-auto max-w-4xl px-4 py-16 md:px-8 md:py-24">
        <header className="mb-10 space-y-4">
          <p className="as-eyebrow text-[var(--auto-muted-foreground,#737373)]">
            LGPD
          </p>
          <h1 className="as-h1 text-[var(--auto-foreground,#0a0a0a)]">
            Política de Privacidade
          </h1>
          <p className="as-body-lg text-[var(--auto-muted-foreground,#737373)]">
            Esta política explica como {variables.business_name} coleta, usa e
            protege dados pessoais em seus canais digitais.
          </p>
        </header>

        <div className="space-y-8 text-[var(--auto-foreground,#0a0a0a)]">
          <Section title="Dados coletados">
            Coletamos dados informados voluntariamente em formulários, como
            nome, e-mail, telefone, interesse em veículo e mensagem. Também
            podemos registrar dados técnicos necessários, como endereço IP,
            navegador e preferências de cookies.
          </Section>

          <Section title="Finalidades">
            Usamos os dados para responder solicitações, apresentar veículos,
            avaliar propostas de compra ou troca, manter segurança do site,
            cumprir obrigações legais e, mediante consentimento, medir
            desempenho de navegação e campanhas.
          </Section>

          <Section title="Base legal">
            O tratamento pode ocorrer com base no consentimento do titular,
            execução de procedimentos preliminares a contrato, legítimo
            interesse, cumprimento de obrigação legal ou regulatória e exercício
            regular de direitos.
          </Section>

          <Section title="Compartilhamento">
            Dados podem ser compartilhados com operadores necessários para
            hospedagem, comunicação, atendimento, segurança, análise de métricas
            consentidas e cumprimento de obrigações legais. Não vendemos dados
            pessoais.
          </Section>

          <Section title="Direitos do titular">
            Você pode solicitar acesso, confirmação de tratamento, correção,
            retificação, exclusão, anonimização, bloqueio, portabilidade,
            informação sobre compartilhamento e revogação do consentimento.
          </Section>

          <Section title="Cookies">
            Cookies necessários ficam sempre ativos para funcionamento e
            segurança. Cookies de analytics e marketing são opcionais e só são
            ativados após consentimento explícito.
          </Section>

          <Section title="Contato encarregado">
            Para exercer direitos ou tirar dúvidas sobre privacidade, fale com{" "}
            {variables.business_name} pelo e-mail{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="underline underline-offset-4"
            >
              {contactEmail}
            </a>
            .
          </Section>
        </div>
      </article>
    </SitePage>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="as-h3">{title}</h2>
      <p className="as-body text-[var(--auto-muted-foreground,#737373)]">
        {children}
      </p>
    </section>
  );
}
