// Les éditions illustrées de Wikisource emploient des vers invisibles pour
// aligner la poésie et des images pour les lettrines. Ce sont des éléments
// typographiques : ne pas répéter les premiers, ne pas perdre les secondes.
export function nettoyerTypographie(html) {
  const pile = [];
  let masques = 0;
  return html.split(/(<\/?span\b[^>]*>)/gi).map((morceau) => {
    if (/^<span\b/i.test(morceau)) {
      const masque = /visibility\s*:\s*hidden/i.test(morceau);
      pile.push(masque);
      if (masque) masques++;
      return masques ? '' : morceau;
    }
    if (/^<\/span/i.test(morceau)) {
      const etaitMasque = masques > 0;
      if (pile.pop()) masques--;
      return etaitMasque ? '' : morceau;
    }
    if (masques) return '';
    return morceau.replace(/<img\b[^>]*\balt="([A-ZÀÂÉÈÊÎÔÙÛÇ])"[^>]*>/g,
      (_, lettre) => `@@LETTRINE:${lettre}@@`);
  }).join('');
}

export function recollerLettrines(texte) {
  return texte.replace(/@@LETTRINE:([A-ZÀÂÉÈÊÎÔÙÛÇ])@@\s*/g, '$1');
}
