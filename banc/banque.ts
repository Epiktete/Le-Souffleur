// VERSER UN SPECTACLE À LA BANQUE — outillage de développement.
//
// L'application tourne entièrement dans le navigateur : elle ne peut pas écrire
// dans le dépôt. Le fonds est donc alimenté par le banc et le relais, qui
// fabriquent de vrais spectacles hors navigateur et ont déjà l'objet complet en
// mémoire. On le variabilise, on l'écrit, on le commite.
//
// Après tout versement : node tools/indexer-banque.mjs

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { NomResiduel, variabiliser, type SpectacleModele } from '../src/services/banque';
import type { Spectacle } from '../src/types';

const DOSSIER = resolve('banque/spectacles');

/**
 * Le prochain identifiant libre pour ce conte : « ru-kolobok--1 », puis « --2 ».
 * On ne remplace jamais un spectacle déjà versé — deux adaptations du même
 * conte sont deux spectacles, et le fonds vit de cette variété.
 */
function versesPourCeConte(conteId: string): string[] {
  mkdirSync(DOSSIER, { recursive: true });
  const prefixe = `${conteId}--`;
  return readdirSync(DOSSIER).filter((f) => f.startsWith(prefixe) && f.endsWith('.json'));
}

function prochainId(conteId: string): string {
  const prefixe = `${conteId}--`;
  const pris = versesPourCeConte(conteId)
    .map((f) => Number(f.slice(prefixe.length, -'.json'.length)))
    .filter((n) => Number.isInteger(n));
  return `${prefixe}${(pris.length ? Math.max(...pris) : 0) + 1}`;
}

/**
 * Le même spectacle est-il DÉJÀ au fonds ? Le relais rejoue les mêmes réponses
 * autant de fois qu'on le relance : sans cette comparaison, chaque relance
 * ajouterait un doublon parfait au dépôt. On compare tout sauf l'identifiant,
 * seul champ que le versement invente.
 */
function dejaVerse(modele: SpectacleModele): string | null {
  const sansId = ({ id: _, ...reste }: SpectacleModele) => JSON.stringify(reste);
  const empreinte = sansId(modele);
  for (const f of versesPourCeConte(modele.conteId)) {
    const ancien = JSON.parse(readFileSync(join(DOSSIER, f), 'utf8')) as SpectacleModele;
    if (sansId(ancien) === empreinte) return ancien.id;
  }
  return null;
}

/**
 * Variabilise un spectacle et l'écrit dans `banque/spectacles/`.
 *
 * Renvoie le chemin écrit, ou null si le spectacle n'est pas versable — sans
 * `conteId` il n'a pas d'origine connue, donc rien à quoi l'apparier plus tard.
 *
 * Un nom de marionnette qui subsisterait après variabilisation fait REFUSER le
 * versement, volontairement : mieux vaut un fonds plus petit qu'un fonds qui
 * distribue des noms d'une autre famille. Le refus n'interrompt pas le banc,
 * qui est là pour écrire un spectacle, pas pour alimenter la banque : il se dit
 * à voix haute et le cas se termine normalement.
 */
export function verserALaBanque(spectacle: Spectacle): string | null {
  const conteId = spectacle.bible.conteId;
  if (!conteId) {
    console.warn('  banque : spectacle sans conteId, non versé.');
    return null;
  }
  // Un spectacle que la revue finale n'a pas relu n'entre pas au fonds : il
  // y serait resservi à d'autres familles avec ses défauts.
  if ((spectacle.bible.relecture as { echec?: string } | undefined)?.echec) {
    console.warn('  banque : NON VERSÉ — la revue finale a échoué, le spectacle n’a pas été relu.');
    return null;
  }

  let modele: SpectacleModele;
  try {
    modele = variabiliser(spectacle, prochainId(conteId));
  } catch (e) {
    if (!(e instanceof NomResiduel)) throw e;
    console.warn(`  banque : NON VERSÉ — ${e.message}`);
    return null;
  }
  const double = dejaVerse(modele);
  if (double) {
    console.log(`  banque : déjà au fonds sous ${double}, rien à verser.`);
    return null;
  }

  const chemin = join(DOSSIER, `${modele.id}.json`);
  writeFileSync(chemin, `${JSON.stringify(modele, null, 2)}\n`);
  console.log(`  banque : ${modele.id} versé (${modele.roles.length} rôle(s)).`);
  return chemin;
}

/** Vrai si le fonds existe déjà sur le disque. */
export function banqueExiste(): boolean {
  return existsSync(DOSSIER);
}
