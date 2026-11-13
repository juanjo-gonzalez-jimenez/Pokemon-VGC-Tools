const CREDITS: Array<{what: string; who: string; href: string; note?: string}> = [
  {what: 'Usage statistics', who: 'Smogon', href: 'https://www.smogon.com/stats/'},
  {
    what: 'Pokémon, move and item data, sprites and icons',
    who: 'Pokémon Showdown',
    href: 'https://github.com/smogon/pokemon-showdown',
    note: 'MIT License, © 2011–2026 Guangcong Luo and other contributors. Sprites and icons are loaded from Showdown.',
  },
  {
    what: 'Damage calculator',
    who: '@smogon/calc',
    href: 'https://github.com/smogon/damage-calc',
    note: 'MIT License.',
  },
  {what: 'Tournament teams', who: 'Limitless', href: 'https://play.limitlesstcg.com/'},
  {
    what: 'Fonts',
    who: 'Fira Sans and Chakra Petch',
    href: 'https://fontsource.org/',
    note: 'SIL Open Font License, bundled with the app.',
  },
];

/** Fan-project disclaimer and credits, at the bottom of every tab. */
export function LegalFooter() {
  return (
    <footer className="legal-footer muted">
      <p>
        Unofficial fan project, not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon
        Company. Pokémon and all related names and images are trademarks and © of their respective owners.
      </p>
      <details>
        <summary>Credits</summary>
        <ul>
          {CREDITS.map(c => (
            <li key={c.who}>
              {c.what}:{' '}
              <a href={c.href} target="_blank" rel="noreferrer">
                {c.who}
              </a>
              {c.note && <> · {c.note}</>}
            </li>
          ))}
        </ul>
      </details>
    </footer>
  );
}
