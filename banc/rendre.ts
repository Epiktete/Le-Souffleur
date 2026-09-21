// Mise en forme d'un spectacle pour le banc d'essai. Outillage, jamais livré.
//
// Une seule règle gouverne ce fichier : `scriptPourLeParent` ne doit contenir
// QUE ce que le parent a sous les yeux. Ni le conte d'origine, ni son texte
// transposé, ni le découpage, ni les notes de travail du modèle.
//
// C'est la condition pour que les juges soient utiles : un juge qui verrait
// l'échafaudage comprendrait ce que personne d'autre ne comprend, et
// laisserait passer exactement les absurdités qu'on cherche.

import type { Acte, ElementScript, Marionnette, Spectacle } from '../src/types';
import { formaterDuree } from '../src/services/duree';

function nomDe(distribution: Marionnette[], id: string): string {
  return distribution.find((m) => m.id === id)?.nom ?? id;
}

function rendreElement(e: ElementScript, distribution: Marionnette[]): string {
  switch (e.type) {
    case 'replique': {
      const ton = e.ton ? ` *(${e.ton})*` : '';
      return `**${nomDe(distribution, e.marionnetteId)}**${ton} — ${e.texte}`;
    }
    case 'adresse_public': {
      const attente = e.attenteReponse ? ', et attend la réponse' : '';
      return `**${nomDe(distribution, e.marionnetteId)}** *(au public${attente})* — ${e.texte}`;
    }
    case 'didascalie':
      return `*${e.texte}*`;
    case 'note_marionnettiste':
      return `> Note : ${e.texte}`;
    case 'entree':
      return `*[ ${nomDe(distribution, e.marionnetteId)} entre — main ${e.mainMarionnettiste} ]*`;
    case 'sortie':
      return `*[ ${nomDe(distribution, e.marionnetteId)} sort — main ${e.mainMarionnettiste} ]*`;
  }
}

function rendreActe(acte: Acte, spectacle: Spectacle): string {
  const tableau = spectacle.tableaux.find((t) => t.id === acte.tableauId);
  const decor = tableau ? `\n*Décor : ${tableau.titre}*\n` : '';
  const corps = acte.elements
    .map((e) => rendreElement(e, spectacle.distribution))
    .join('\n\n');
  return `## Acte ${acte.numero} — ${acte.titre}\n${decor}\n${corps}`;
}

/** Le script tel que le parent le reçoit, et rien de plus. */
export function scriptPourLeParent(spectacle: Spectacle): string {
  const p = spectacle.parametres;

  const personnages = spectacle.distribution
    .map((m) => {
      const traits = m.traits.length ? ` — ${m.traits.join(', ')}` : '';
      const voix = m.voix ? ` (${m.voix})` : '';
      return `- **${m.nom}**${traits}${voix}`;
    })
    .join('\n');

  const decors = spectacle.tableaux
    .map((t) => {
      const acc = t.accessoires.length
        ? `\n  Accessoires : ${t.accessoires.join(', ')}`
        : '';
      return `- **${t.titre}** — ${t.description}${acc}`;
    })
    .join('\n');

  const actes = spectacle.actes.map((a) => rendreActe(a, spectacle)).join('\n\n---\n\n');

  return `# ${spectacle.titre}

${spectacle.pitch}

Spectacle de marionnettes à main, joué à la maison derrière une table.
Public : ${p.ageAuditoire} ans. ${p.nbMarionnettistes} marionnettiste${p.nbMarionnettistes > 1 ? 's' : ''}.
Durée estimée : ${formaterDuree(spectacle.dureeEstimeeSecondes)}.

## Personnages

${personnages}

## Décors à préparer

${decors}

---

${actes}
`;
}

/** Tout le reste : la bible, les problèmes, le coût. Pour moi seul. */
export function coulisses(spectacle: Spectacle, extra: Record<string, unknown>): string {
  return JSON.stringify(
    {
      titre: spectacle.titre,
      parametres: spectacle.parametres,
      dureeEstimeeSecondes: spectacle.dureeEstimeeSecondes,
      nbActes: spectacle.actes.length,
      nbTableaux: spectacle.tableaux.length,
      bible: spectacle.bible,
      ...extra,
    },
    null,
    2,
  );
}
