const FILLS: Record<string, string> = {
  rouge: '#c62828',
  bleu: '#1565c0',
  vert: '#2e7d32',
  jaune: '#f9a825',
  violet: '#6a1b9a',
  ocre: '#b8860b',
  gris: '#616161',
  or: '#c9a227',
  brun: '#6d4c41',
};

function shape(symbol: string, fill: string): string {
  if (symbol === 'cercle' || symbol === 'bouton') return `<circle cx="24" cy="24" r="14" fill="${fill}"/>`;
  if (symbol === 'carre') return `<rect x="10" y="10" width="28" height="28" fill="${fill}"/>`;
  if (symbol === 'triangle') return `<polygon points="24,8 42,40 6,40" fill="${fill}"/>`;
  if (symbol === 'etoile' || symbol === 'soleil') {
    return `<polygon points="24,4 29,18 44,18 32,28 36,42 24,33 12,42 16,28 4,18 19,18" fill="${fill}"/>`;
  }
  if (symbol === 'lune') return `<path d="M30 8a16 16 0 1 0 0 32 12 12 0 1 1 0-32z" fill="${fill}"/>`;
  if (symbol === 'cle' || symbol === 'cle-symbole') {
    return `<circle cx="16" cy="24" r="8" fill="none" stroke="${fill}" stroke-width="4"/><rect x="22" y="21" width="18" height="6" fill="${fill}"/>`;
  }
  if (symbol === 'feuille') return `<ellipse cx="24" cy="24" rx="10" ry="16" transform="rotate(-30 24 24)" fill="${fill}"/>`;
  if (symbol === 'levier') return `<rect x="22" y="8" width="6" height="28" fill="${fill}"/><circle cx="25" cy="8" r="6" fill="${fill}"/>`;
  if (symbol === 'manivelle') return `<circle cx="16" cy="28" r="8" fill="none" stroke="${fill}" stroke-width="4"/><rect x="20" y="12" width="16" height="5" fill="${fill}"/>`;
  if (symbol === 'pedale') return `<rect x="8" y="20" width="32" height="10" rx="3" fill="${fill}"/>`;
  if (symbol === 'corde') return `<path d="M8 24c8-12 24-12 32 0" fill="none" stroke="${fill}" stroke-width="4"/>`;
  if (symbol === 'crochet') return `<path d="M30 8v20a10 10 0 1 1-8 0" fill="none" stroke="${fill}" stroke-width="4"/>`;
  if (symbol === 'pile') return `<rect x="14" y="12" width="20" height="26" fill="${fill}"/><rect x="20" y="6" width="8" height="6" fill="${fill}"/>`;
  if (symbol === 'ampoule') return `<circle cx="24" cy="20" r="10" fill="${fill}"/><rect x="20" y="30" width="8" height="8" fill="${fill}"/>`;
  if (symbol === 'anneau') return `<circle cx="24" cy="24" r="12" fill="none" stroke="${fill}" stroke-width="5"/>`;
  if (symbol === 'fiole') return `<rect x="18" y="8" width="12" height="8" fill="${fill}"/><polygon points="14,18 34,18 30,42 18,42" fill="${fill}"/>`;
  if (symbol === 'chiffon') return `<polygon points="8,14 34,8 40,36 12,40" fill="${fill}"/>`;
  if (symbol === 'noeud') return `<circle cx="16" cy="24" r="6" fill="${fill}"/><circle cx="32" cy="24" r="6" fill="${fill}"/>`;
  return `<rect x="12" y="8" width="24" height="32" fill="${fill}"/>`;
}

export function symbolFigure(symbol: string, color: string): string {
  const fill = FILLS[color] ?? '#6d4c41';
  return `<span class="glyph-wrap"><svg class="glyph" viewBox="0 0 48 48" aria-hidden="true">${shape(symbol, fill)}</svg></span>`;
}

export function lynxPortrait(): string {
  return `<div class="lynx" aria-hidden="true"><i class="ear left"></i><i class="ear right"></i><i class="face"></i><i class="tuft"></i></div>`;
}
