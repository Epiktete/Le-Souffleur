// Sauvegarde : export et import de toutes les données (CDC §12).
//
// Les données ne vivent que dans ce navigateur : un nettoyage de l'historique
// peut tout effacer. Le fichier exporté est donc la SEULE sauvegarde du
// parent. Il contient les marionnettes, les spectacles et les réglages —
// JAMAIS la clé API, qu'elle soit mémorisée ou non.

import { z } from 'zod';
import { VERSION_SCHEMA } from '../config';
import { ouvrirBase } from './db';
import type { CleReglage, Marionnette, Reglage, ReglagesIa, Spectacle } from '../types';

/** Ce qu'identifie un fichier de sauvegarde du Souffleur. */
export const FORMAT_SAUVEGARDE = 'le-souffleur';

export interface Sauvegarde {
  format: typeof FORMAT_SAUVEGARDE;
  /** Version du schéma des données au moment de l'export (CDC §4). */
  versionSchema: number;
  /** Date de l'export, ISO 8601. */
  exporteLe: string;
  marionnettes: Marionnette[];
  spectacles: Spectacle[];
  reglages: Reglage[];
}

/** Ce que le parent voit avant d'importer : de quoi décider. */
export interface Apercu {
  exporteLe: string;
  marionnettes: number;
  spectacles: number;
  /** Titres des spectacles, pour reconnaître le fichier. */
  titres: string[];
}

/* ---------------------------------------------------------------- */
/* Export                                                            */
/* ---------------------------------------------------------------- */

/** Retire la clé API d'un réglage, où qu'elle se trouve. */
function sansCle(r: Reglage): Reglage {
  if (r.cle !== 'ia') return r;
  const { cle: _cle, ...reste } = r.valeur as ReglagesIa;
  return { cle: r.cle, valeur: reste };
}

/** Toutes les données de ce navigateur, sans la clé. */
export async function exporterTout(): Promise<Sauvegarde> {
  const db = await ouvrirBase();
  const [marionnettes, spectacles, reglages] = await Promise.all([
    db.getAll('marionnettes'),
    db.getAll('spectacles'),
    db.getAll('reglages'),
  ]);
  return {
    format: FORMAT_SAUVEGARDE,
    versionSchema: VERSION_SCHEMA,
    exporteLe: new Date().toISOString(),
    // Une marionnette d'avant la suppression de la photo peut encore porter
    // son image (un Blob), qu'un fichier texte ne sait pas contenir.
    marionnettes: marionnettes.map((m) => {
      const { photo: _photo, ...reste } = m as Marionnette & { photo?: unknown };
      return reste;
    }),
    spectacles,
    reglages: reglages.map(sansCle),
  };
}

/**
 * Un seul spectacle, pour l'envoyer à un autre parent (CDC §12). Sa
 * distribution voyage avec lui : c'en est une copie figée. Ni marionnettes de
 * la Marionnethèque, ni réglages.
 */
export function exporterSpectacle(s: Spectacle): Sauvegarde {
  return {
    format: FORMAT_SAUVEGARDE,
    versionSchema: VERSION_SCHEMA,
    exporteLe: new Date().toISOString(),
    marionnettes: [],
    spectacles: [s],
    reglages: [],
  };
}

/** Le nom du fichier : on le reconnaît dans un dossier de téléchargements. */
export function nomDeFichier(quoi: string, date = new Date()): string {
  const propre = quoi
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `le-souffleur-${propre}-${date.toISOString().slice(0, 10)}.json`;
}

/** Fait télécharger un objet en fichier JSON. Aucun appel réseau. */
export function telecharger(nom: string, contenu: Sauvegarde): void {
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  // Le navigateur a pris le fichier ; on libère la mémoire un peu plus tard.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------- */
/* Lecture d'un fichier                                              */
/* ---------------------------------------------------------------- */

// Le fichier vient de l'extérieur : on vérifie ce qui casserait l'application
// (un identifiant, un nom, des actes), et on laisse passer le reste tel quel.
const schemaMarionnette = z.looseObject({
  id: z.string().min(1),
  nom: z.string().min(1),
  description: z.string().default(''),
  traits: z.array(z.string()).default([]),
  creeLe: z.string().default(''),
  modifieLe: z.string().default(''),
});

const schemaSpectacle = z.looseObject({
  id: z.string().min(1),
  titre: z.string(),
  parametres: z.looseObject({}),
  distribution: z.array(z.looseObject({ id: z.string(), nom: z.string() })),
  tableaux: z.array(z.looseObject({ id: z.string() })),
  actes: z.array(z.looseObject({ id: z.string(), elements: z.array(z.looseObject({ type: z.string() })) })),
  creeLe: z.string(),
});

const CLES_REGLAGES: CleReglage[] = ['ia', 'studio', 'taillePrompteur', 'versionSchema'];

const schemaSauvegarde = z.object({
  format: z.literal(FORMAT_SAUVEGARDE),
  versionSchema: z.number().int(),
  exporteLe: z.string(),
  marionnettes: z.array(schemaMarionnette).default([]),
  spectacles: z.array(schemaSpectacle).default([]),
  reglages: z.array(z.object({ cle: z.string(), valeur: z.unknown() })).default([]),
});

export type LectureSauvegarde =
  | { ok: true; sauvegarde: Sauvegarde; apercu: Apercu }
  | { ok: false; erreur: 'illisible' | 'pasSouffleur' | 'tropRecent' };

/** Lit le texte d'un fichier choisi par le parent, sans rien écrire. */
export function lireSauvegarde(texte: string): LectureSauvegarde {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: 'illisible' };
  }
  const r = schemaSauvegarde.safeParse(brut);
  if (!r.success) return { ok: false, erreur: 'pasSouffleur' };
  // Un fichier d'une version future pourrait porter des données que cette
  // version ne sait pas lire : on refuse plutôt que d'abîmer.
  if (r.data.versionSchema > VERSION_SCHEMA) return { ok: false, erreur: 'tropRecent' };

  const sauvegarde: Sauvegarde = {
    ...r.data,
    format: FORMAT_SAUVEGARDE,
    marionnettes: r.data.marionnettes as unknown as Marionnette[],
    spectacles: r.data.spectacles as unknown as Spectacle[],
    // Seuls les réglages connus passent, et jamais une clé API — même si
    // quelqu'un en avait glissé une à la main dans le fichier.
    reglages: r.data.reglages
      .filter((x): x is Reglage => CLES_REGLAGES.includes(x.cle as CleReglage) && x.cle !== 'versionSchema')
      .map(sansCle),
  };
  return {
    ok: true,
    sauvegarde,
    apercu: {
      exporteLe: sauvegarde.exporteLe,
      marionnettes: sauvegarde.marionnettes.length,
      spectacles: sauvegarde.spectacles.length,
      titres: sauvegarde.spectacles.map((s) => s.titre),
    },
  };
}

/* ---------------------------------------------------------------- */
/* Import                                                            */
/* ---------------------------------------------------------------- */

export interface BilanImport {
  marionnettes: number;
  spectacles: number;
  /** Éléments déjà présents (même identifiant), laissés tels quels. */
  ignores: number;
}

/**
 * Écrit une sauvegarde dans ce navigateur (CDC §12).
 *
 * - « ajouter » : ce qui existe déjà sous le même identifiant est gardé tel
 *   quel, le reste est ajouté ;
 * - « remplacer » : marionnettes et spectacles sont effacés, puis remplacés.
 *   Les réglages du fichier remplacent ceux d'ici, mais la clé API de CE
 *   navigateur est gardée : le fichier n'en contient jamais.
 *
 * Tout se fait en une seule transaction : un import qui échoue en route
 * n'écrit rien, et ne laisse pas des données à moitié remplacées.
 */
export async function importer(s: Sauvegarde, mode: 'ajouter' | 'remplacer'): Promise<BilanImport> {
  const db = await ouvrirBase();
  const tx = db.transaction(['marionnettes', 'spectacles', 'reglages'], 'readwrite');
  const magMarionnettes = tx.objectStore('marionnettes');
  const magSpectacles = tx.objectStore('spectacles');
  const magReglages = tx.objectStore('reglages');
  const bilan: BilanImport = { marionnettes: 0, spectacles: 0, ignores: 0 };

  if (mode === 'remplacer') {
    await magMarionnettes.clear();
    await magSpectacles.clear();
  }

  for (const m of s.marionnettes) {
    if (mode === 'ajouter' && (await magMarionnettes.getKey(m.id)) !== undefined) {
      bilan.ignores++;
      continue;
    }
    await magMarionnettes.put(m);
    bilan.marionnettes++;
  }
  for (const sp of s.spectacles) {
    if (mode === 'ajouter' && (await magSpectacles.getKey(sp.id)) !== undefined) {
      bilan.ignores++;
      continue;
    }
    await magSpectacles.put(sp);
    bilan.spectacles++;
  }

  // Les réglages ne remplacent ceux d'ici qu'en mode « remplacer » : ajouter
  // les marionnettes d'un autre parent ne doit pas changer son studio.
  if (mode === 'remplacer') {
    for (const r of s.reglages) {
      if (r.cle === 'ia') {
        const ici = (await magReglages.get('ia'))?.valeur as ReglagesIa | undefined;
        const valeur = { ...(r.valeur as ReglagesIa), ...(ici?.cle ? { cle: ici.cle } : {}) };
        await magReglages.put({ cle: 'ia', valeur });
      } else {
        await magReglages.put(r);
      }
    }
  }

  await tx.done;
  return bilan;
}

/* ---------------------------------------------------------------- */
/* Rappel « Pensez à sauvegarder »                                   */
/* ---------------------------------------------------------------- */

const CLE_RAPPEL = 'souffleur.spectaclesDepuisExport';

/** Nombre de spectacles créés depuis le dernier export, sur cet appareil. */
function compteur(): number {
  try {
    return Number(localStorage.getItem(CLE_RAPPEL) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * À appeler à chaque spectacle créé. Renvoie vrai quand il faut rappeler de
 * sauvegarder : au 3e spectacle sans export, puis au 6e, etc. (CDC §12).
 */
export function noterSpectacleCree(): boolean {
  const n = compteur() + 1;
  try {
    localStorage.setItem(CLE_RAPPEL, String(n));
  } catch {
    // Stockage indisponible (navigation privée) : pas de rappel, rien de grave.
  }
  return n % 3 === 0;
}

/** Un export remet le compteur à zéro. */
export function noterExport(): void {
  try {
    localStorage.setItem(CLE_RAPPEL, '0');
  } catch {
    // idem
  }
}
