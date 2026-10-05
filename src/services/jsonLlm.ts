// Lecture des réponses du modèle (CDC §6, « Lecture des réponses »).
//
// Un modèle ne renvoie jamais exactement ce qu'on lui demande : il encadre le
// JSON de balises de code, ajoute une phrase avant ou après, ou se fait couper
// en cours de route. Ces fonctions absorbent ces cas.
//
// Ce code a été écrit et éprouvé lors de l'étape 0, sur les réponses réelles
// d'OpenRouter.

/** Résultat d'une extraction : soit la valeur, soit la raison de l'échec. */
export type Extraction =
  | { ok: true; valeur: unknown }
  | { ok: false; erreur: string };

/**
 * Extrait le premier objet JSON complet d'un texte.
 *
 * Les accolades sont comptées en ignorant celles qui se trouvent dans une
 * chaîne de caractères : sans cela, un texte comme `{"couleur": "rou}ge"}`
 * serait coupé au mauvais endroit.
 */
export function extraireJson(texte: string): Extraction {
  if (typeof texte !== 'string' || texte.trim() === '') {
    return { ok: false, erreur: 'Réponse vide' };
  }

  const sansBalises = texte.replace(/```(?:json)?/gi, '').trim();
  const debut = sansBalises.indexOf('{');
  if (debut === -1) return { ok: false, erreur: 'Aucun objet JSON trouvé dans la réponse' };

  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  let fin = -1;

  for (let i = debut; i < sansBalises.length; i++) {
    const c = sansBalises[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === '\\') echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === '{') profondeur++;
    else if (c === '}' && --profondeur === 0) { fin = i; break; }
  }

  if (fin === -1) return { ok: false, erreur: 'JSON tronqué (accolade fermante manquante)' };

  try {
    return { ok: true, valeur: JSON.parse(sansBalises.slice(debut, fin + 1)) };
  } catch (e) {
    return { ok: false, erreur: `JSON mal formé : ${(e as Error).message}` };
  }
}
