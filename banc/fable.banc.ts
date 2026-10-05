// LE VERSEMENT DES SPECTACLES ÉCRITS HORS LIGNE — outillage, jamais livré.
//
// Les spectacles du lot « fable » sont écrits par des agents Claude, sans
// aucun appel réseau (règle du 2026-09-28), sous la forme décrite par
// banc/FABLE.md : un spectacle complet, plus ses annotations (accords vers
// l'autre genre, adresses au public classées).
//
// Ce fichier fait tout le reste, et VÉRIFIE AVANT D'ÉCRIRE :
//   - variabilisation (noms → {{r1}}), garde-fou des noms résiduels ;
//   - durée recalculée depuis les actes ;
//   - genre de chaque rôle lisible sur la peluche d'origine ;
//   - chaque « avant » des accords retrouvé, exact, dans la ligne visée
//     du modèle variabilisé ;
//   - le classement des interactions couvre exactement les adresses.
// Une faute = le cas échoue, rien n'est écrit pour ce spectacle.
//
// Lancement :  BANC_FABLE=tous npm run banc:fable   (ou une liste d'ids)
// Après versement : npm run banque   (réindexe le fonds)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';

import type { Spectacle } from '../src/types';
import { lignesModele, rendreMention, variabiliser, NomResiduel } from '../src/services/banque';
import { conteParId } from '../src/services/repertoire';
import { dureeSpectacle } from '../src/services/duree';

const DEMANDES = (process.env.BANC_FABLE ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const SOURCE = resolve('banc/sorties/fable');
const FONDS = resolve('banque/spectacles');

interface Enveloppe {
  spectacle: Spectacle;
  accords: { role: number; remplacements: { id: string; avant: string; apres: string }[] }[];
  interactions: string[];
  /**
   * L'espèce de chaque rôle (étape K, 2026-09-28) : soit imposée (l'âme du
   * conte), soit ses mentions à mettre à l'espèce de la peluche du parent.
   * Un rôle absent de la liste n'a aucune mention.
   */
  especes?: {
    role: number;
    imposee?: boolean;
    mentions?: { id: string; avant: string; gabarit: string }[];
  }[];
}

const FICHIERS = existsSync(SOURCE)
  ? readdirSync(SOURCE).filter((f) => f.endsWith('.json')).sort()
  : [];
const RETENUS = DEMANDES.includes('tous')
  ? FICHIERS
  : FICHIERS.filter((f) => DEMANDES.includes(f.replace(/\.json$/, '')));

for (const fichier of FICHIERS) {
  const retenu = RETENUS.includes(fichier);
  test.skipIf(!retenu)(`verser ${fichier}`, () => {
    const conteId = fichier.replace(/\.json$/, '');
    const enveloppe = JSON.parse(readFileSync(join(SOURCE, fichier), 'utf8')) as Enveloppe;
    const spectacle = enveloppe.spectacle;

    if (spectacle.bible?.conteId !== conteId) {
      throw new Error(`bible.conteId « ${spectacle.bible?.conteId} » ≠ nom du fichier « ${conteId} ».`);
    }

    // La durée fait foi depuis les actes, pas depuis l'estimation de l'agent.
    spectacle.dureeEstimeeSecondes = dureeSpectacle(spectacle.actes);

    // Un versement par fichier source : relancer ne doit pas créer de doublon.
    // Pour REMPLACER un modèle, on supprime d'abord son fichier du fonds.
    if (existsSync(join(FONDS, `${conteId}--1.json`))) {
      console.log(`  ${conteId} : déjà au fonds, rien à verser.`);
      return;
    }
    const n = 1;

    // Le garde-fou des noms résiduels est dans variabiliser : un nom oublié
    // fait échouer le cas ici même.
    let modele;
    try {
      modele = variabiliser(spectacle, `${conteId}--${n}`);
    } catch (e) {
      if (e instanceof NomResiduel) {
        throw new Error(`Nom résiduel — renomme la peluche : ${e.message}`);
      }
      throw e;
    }

    // Le genre de chaque rôle doit se lire sur la peluche d'origine : c'est
    // lui qui dit dans quel sens vont les accords.
    for (const role of modele.roles) {
      if (!role.genre) {
        throw new Error(`Rôle ${role.cle} : genre illisible sur la peluche d'origine — `
          + `précise l'espèce ou « Un/Une » dans sa description.`);
      }
    }

    // Les accords : un bloc par rôle, chaque extrait retrouvé tel quel.
    const lignes = new Map(lignesModele(modele).map((l) => [l.id, l]));
    for (const [k, role] of modele.roles.entries()) {
      const bloc = enveloppe.accords.find((a) => a.role === k + 1);
      if (!bloc) throw new Error(`Rôle ${role.cle} : bloc d'accords manquant.`);
      for (const r of bloc.remplacements) {
        const ligne = lignes.get(r.id);
        if (!ligne) throw new Error(`Rôle ${role.cle} : ligne inconnue « ${r.id} ».`);
        if (!ligne.lire().includes(r.avant)) {
          throw new Error(`Rôle ${role.cle} : « avant » introuvable dans [${r.id}] : « ${r.avant} ».`);
        }
      }
      role.accords = {
        vers: role.genre === 'masculin' ? 'feminin' : 'masculin',
        remplacements: bloc.remplacements,
      };
    }

    // L'espèce : chaque mention est retrouvée telle quelle, et son gabarit,
    // rendu avec l'espèce et le genre d'origine, redonne l'extrait exact —
    // le même invariant que tests/fonds.test.ts, vérifié AVANT d'écrire.
    const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const bloc of enveloppe.especes ?? []) {
      const role = modele.roles[bloc.role - 1];
      if (!role) throw new Error(`Espèces : rôle ${bloc.role} inconnu.`);
      if (bloc.imposee && bloc.mentions?.length) {
        throw new Error(`Rôle ${role.cle} : une espèce est imposée OU suit la peluche, pas les deux.`);
      }
      if (bloc.imposee) role.especeImposee = true;
      for (const mention of bloc.mentions ?? []) {
        const ligne = lignes.get(mention.id);
        if (!ligne) throw new Error(`Rôle ${role.cle} : ligne inconnue « ${mention.id} ».`);
        if (!ligne.lire().includes(mention.avant)) {
          throw new Error(`Rôle ${role.cle} : mention introuvable dans [${mention.id}] : « ${mention.avant} ».`);
        }
        const rendu = rendreMention(mention.gabarit, role.espece ?? '', role.genre ?? 'masculin');
        if (sansAccents(rendu) !== sansAccents(mention.avant)) {
          throw new Error(`Rôle ${role.cle} [${mention.id}] : le gabarit « ${mention.gabarit} » `
            + `donne « ${rendu} », pas « ${mention.avant} ».`);
        }
      }
      if (bloc.mentions?.length) role.especeMentions = bloc.mentions;
    }

    // Autant de marionnettes au moins que la fiche compte de rôles
    // principaux : un héros ne passe jamais en coulisse (2026-09-28).
    const conte = conteParId(conteId);
    if (conte && modele.roles.length < conte.personnages) {
      throw new Error(`${modele.roles.length} marionnette(s) pour ${conte.personnages} rôles principaux `
        + 'dans la fiche : un personnage principal serait joué en coulisse.');
    }

    // Les interactions : exactement les adresses au public, toutes classées.
    const adresses = modele.actes.flatMap((a) =>
      a.elements.filter((e) => e.type === 'adresse_public').map((e) => e.id));
    const attendu = [...adresses].sort().join(',');
    const recu = [...enveloppe.interactions].sort().join(',');
    if (attendu !== recu) {
      throw new Error(`Le classement des interactions ne couvre pas exactement : `
        + `attendu ${attendu || '(rien)'}, reçu ${recu || '(rien)'}.`);
    }
    modele.interactionsOrdonnees = enveloppe.interactions;

    writeFileSync(join(FONDS, `${modele.id}.json`), `${JSON.stringify(modele, null, 2)}\n`);
    const nbAccords = modele.roles.reduce((s, r) => s + (r.accords?.remplacements.length ?? 0), 0);
    console.log(`  ${modele.id} versé — ${Math.round(spectacle.dureeEstimeeSecondes / 60)} min réelles, `
      + `${modele.roles.length} rôle(s), ${nbAccords} accord(s), ${adresses.length} adresse(s) au public.`
      + '\n  Penser à réindexer : npm run banque');
  });
}
