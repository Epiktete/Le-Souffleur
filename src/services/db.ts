// Accès au stockage local (CDC §3 et §4).
//
// Tout vit dans le navigateur de l'utilisateur : il n'y a pas de serveur.
// IndexedDB est utilisée plutôt que localStorage car elle accepte le volume des
// spectacles et sait stocker autre chose que du texte.
//
// L'interface n'appelle jamais IndexedDB en direct : elle passe par ce service.
// C'est ce qui permettra d'ajouter un proxy serveur en V2 sans toucher aux écrans.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { VERSION_SCHEMA } from '../config';
import type { CleReglage, Marionnette, Reglage, ReglagesParCle, Spectacle } from '../types';

const NOM_BASE = 'le-souffleur';

/** Les trois magasins imposés par le CDC §4. */
interface SchemaSouffleur extends DBSchema {
  marionnettes: {
    key: string;
    value: Marionnette;
    indexes: { modifieLe: string };
  };
  spectacles: {
    key: string;
    value: Spectacle;
    indexes: { creeLe: string };
  };
  reglages: {
    key: CleReglage;
    value: Reglage;
  };
}

let base: Promise<IDBPDatabase<SchemaSouffleur>> | null = null;

/**
 * Ouvre la base, en la créant au besoin. L'ouverture n'a lieu qu'au premier
 * appel : le simple chargement de l'application ne touche pas au disque.
 */
export function ouvrirBase(): Promise<IDBPDatabase<SchemaSouffleur>> {
  base ??= openDB<SchemaSouffleur>(NOM_BASE, VERSION_SCHEMA, {
    upgrade(db, ancienneVersion) {
      // Les migrations futures s'ajoutent ici, en testant ancienneVersion.
      if (ancienneVersion < 1) {
        const marionnettes = db.createObjectStore('marionnettes', { keyPath: 'id' });
        marionnettes.createIndex('modifieLe', 'modifieLe');

        const spectacles = db.createObjectStore('spectacles', { keyPath: 'id' });
        spectacles.createIndex('creeLe', 'creeLe');

        db.createObjectStore('reglages', { keyPath: 'cle' });
      }
    },
  });
  return base;
}

/** Ferme la base et oublie l'instance. Utile pour les tests. */
export async function fermerBase(): Promise<void> {
  if (!base) return;
  (await base).close();
  base = null;
}

/** Identifiant unique. `randomUUID` exige une origine sécurisée (https ou localhost). */
export function nouvelId(): string {
  return crypto.randomUUID();
}

/* ---------------------------------------------------------------- */
/* Marionnettes                                                      */
/* ---------------------------------------------------------------- */

export async function listerMarionnettes(): Promise<Marionnette[]> {
  const db = await ouvrirBase();
  const toutes = (await db.getAll('marionnettes')).map(sansPhoto);
  // Les plus récemment modifiées en premier.
  return toutes.sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
}

export async function lireMarionnette(id: string): Promise<Marionnette | undefined> {
  const m = await (await ouvrirBase()).get('marionnettes', id);
  return m && sansPhoto(m);
}

/**
 * Les marionnettes créées avant la suppression de la photo gardent un Blob
 * dont plus personne ne se sert. On le retire à la lecture : il disparaît du
 * stockage au premier enregistrement suivant, sans migration de schéma.
 */
function sansPhoto(m: Marionnette): Marionnette {
  if (!('photo' in m)) return m;
  const { photo: _, ...reste } = m as Marionnette & { photo?: unknown };
  return reste;
}

/** Enregistre une marionnette et met à jour sa date de modification. */
export async function enregistrerMarionnette(m: Marionnette): Promise<Marionnette> {
  const aJour = { ...m, modifieLe: new Date().toISOString() };
  await (await ouvrirBase()).put('marionnettes', aJour);
  return aJour;
}

export async function supprimerMarionnette(id: string): Promise<void> {
  await (await ouvrirBase()).delete('marionnettes', id);
}

/* ---------------------------------------------------------------- */
/* Spectacles                                                        */
/* ---------------------------------------------------------------- */

export async function listerSpectacles(): Promise<Spectacle[]> {
  const db = await ouvrirBase();
  const tous = await db.getAll('spectacles');
  // Du plus récent au plus ancien (CDC §7, colonne de droite).
  return tous.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

export async function lireSpectacle(id: string): Promise<Spectacle | undefined> {
  return (await ouvrirBase()).get('spectacles', id);
}

export async function enregistrerSpectacle(s: Spectacle): Promise<Spectacle> {
  const aJour = { ...s, modifieLe: new Date().toISOString() };
  await (await ouvrirBase()).put('spectacles', aJour);
  return aJour;
}

export async function supprimerSpectacle(id: string): Promise<void> {
  await (await ouvrirBase()).delete('spectacles', id);
}

/* ---------------------------------------------------------------- */
/* Réglages                                                          */
/* ---------------------------------------------------------------- */

/** Lit un réglage. Le type de retour suit la clé demandée. */
export async function lireReglage<C extends CleReglage>(
  cle: C,
): Promise<ReglagesParCle[C] | undefined> {
  const db = await ouvrirBase();
  const entree = await db.get('reglages', cle);
  return entree?.valeur as ReglagesParCle[C] | undefined;
}

export async function ecrireReglage<C extends CleReglage>(
  cle: C,
  valeur: ReglagesParCle[C],
): Promise<void> {
  const db = await ouvrirBase();
  await db.put('reglages', { cle, valeur } satisfies Reglage);
}

export async function oublierReglage(cle: CleReglage): Promise<void> {
  await (await ouvrirBase()).delete('reglages', cle);
}

/**
 * Demande au navigateur de ne pas effacer les données automatiquement (CDC §12).
 * Renvoie false si le navigateur refuse ou ne connaît pas cette API.
 */
export async function demanderStockagePersistant(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
