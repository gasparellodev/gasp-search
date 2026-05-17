import "server-only";

import Image from "next/image";

export interface TeamMember {
  name: string;
  role: string;
  photo_url?: string | null;
  bio?: string | null;
}

interface AboutTeamProps {
  members: TeamMember[];
}

/**
 * Grid de membros da equipe — página Sobre (#P5 reescopado).
 *
 * Server Component. Retorna `null` quando `members` está vazio — nenhum
 * shell vazio no DOM. Schema deferred (variables.team ?? [] no caller).
 *
 * Layout: 1 col mobile / 2 cols md / 3 cols lg.
 * Cards com lift suave via shadow + scale via Tailwind transition.
 */
export function AboutTeam({ members }: AboutTeamProps) {
  if (members.length === 0) return null;

  return (
    <section
      aria-labelledby="team-heading"
      className="w-full bg-foreground/[0.02] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mb-12 lg:mb-16">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/55">
            Quem somos
          </p>
          <h2
            id="team-heading"
            className="mt-3 font-bold text-foreground"
            style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)" }}
          >
            Nossa equipe
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <article
              key={member.name}
              className="group flex flex-col items-center rounded-site-feature border border-foreground/10 bg-background p-8 text-center shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
            >
              {member.photo_url && (
                <div className="mb-5 size-24 flex-none overflow-hidden rounded-full">
                  <Image
                    src={member.photo_url}
                    alt={`Foto de ${member.name}`}
                    width={96}
                    height={96}
                    className="size-full object-cover"
                    unoptimized
                  />
                </div>
              )}

              <h3 className="text-lg font-semibold text-foreground">
                {member.name}
              </h3>
              <p className="mt-1 text-sm font-medium uppercase tracking-[0.12em] text-foreground/55">
                {member.role}
              </p>

              {member.bio && (
                <p className="mt-4 text-sm leading-relaxed text-foreground/70">
                  {member.bio}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
