import { Link } from 'react-router'
import RostiLogo from '@/assets/images/rosti-logo.svg'

const SPA_URL = import.meta.env.VITE_SPA_URL ?? 'http://localhost:5174'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="relative flex min-h-[80vh] flex-col justify-end overflow-hidden px-6 pb-16 pt-24 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,#fbbf24_0%,transparent_45%),radial-gradient(circle_at_80%_60%,#f97316_0%,transparent_40%)]" />
        <div className="relative z-10 max-w-3xl text-white">
          <div className="mb-6 flex items-center gap-3">
            <img
              src={RostiLogo}
              alt=""
              className="h-12 w-12 rounded-lg object-contain md:h-14 md:w-14"
            />
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-300">Rösti</p>
          </div>
          <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
            Gère ton club sans le chaos.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/80">
            Planifie les matchs, collecte les RSVP, répartis bleu et rouge, suis les buts et
            règle les frais de session — le tout au même endroit.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href={`${SPA_URL}/register?intent=create`}
              className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Créé ton club
            </a>
            <a
              href={`${SPA_URL}/rejoindre`}
              className="rounded-md border border-white/40 px-5 py-3 text-sm font-semibold text-white"
            >
              Rejoins ton club
            </a>
          </div>
          <p className="mt-6 text-sm text-white/60">
            Déjà un compte ?{' '}
            <a href={`${SPA_URL}/login`} className="underline underline-offset-2 hover:text-white">
              Se connecter
            </a>
          </p>
        </div>
      </section>
      <section className="px-6 py-16 md:px-12">
        <h2 className="text-2xl font-semibold">Pensé pour les matchs entre potes</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Multi-club avec saisons, matchs récurrents, capacité limitée, chat avec mentions, et
          suivi des frais entre joueurs.
        </p>
        <Link className="mt-6 inline-block underline" to="/privacy">
          Politique de confidentialité
        </Link>
      </section>
    </main>
  )
}
