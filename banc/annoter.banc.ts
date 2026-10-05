// L'ANNOTATION DU FONDS — outillage de développement, jamais livré.
//
// Décision du 2026-09-28 : le LLM travaille UNE FOIS POUR TOUTES, hors ligne,
// jamais à la création. Pour chaque modèle de la banque, un appel produit :
//   - par rôle, la liste de remplacements qui bascule ses accords vers
//     L'AUTRE genre grammatical (`roles[].accords`) ;
//   - le classement des adresses au public, de la plus précieuse à la plus
//     retranchable (`interactionsOrdonnees`).
// Le code vérifie chaque extrait avant d'écrire quoi que ce soit : un extrait
// introuvable fait échouer le cas, rien n'est écrit à moitié.
//
// CE FICHIER NE FAIT RIEN sans la variable BANC_ANNOTER :
//   BANC_ANNOTER=tous npm run banc:annoter          (tout le fonds)
//   BANC_ANNOTER=fr-perrault-les-fees--1 npm run banc:annoter
// Après annotation : npm run banque   (réindexe le fonds)
//
// LA CLÉ : lue dans OPENROUTER_API_KEY, jamais écrite, affichée ni journalisée.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';
import { z } from 'zod';

import { appelerModele, type Acces } from '../src/services/connecteurIa';
import { extraireJson } from '../src/services/jsonLlm';
import { promptAnnotationModele } from '../src/prompts';
import { lignesModele, type SpectacleModele } from '../src/services/banque';

const DEMANDES = (process.env.BANC_ANNOTER ?? '').split(',').map((s) => s.trim()).filter(Boolean);

if (DEMANDES.length > 0 && !process.env.OPENROUTER_API_KEY) {
  throw new Error(
    'L’annotation a besoin de la variable d’environnement OPENROUTER_API_KEY.\n'
      + 'Elle est absente de ce terminal. Définissez-la, puis relancez :\n'
      + '  BANC_ANNOTER=tous npm run banc:annoter\n'
      + '(le banc ne lit que sa présence ; il n’écrit et n’affiche jamais sa valeur)',
  );
}

// L'annotation ne se fait qu'une fois par modèle : un grand modèle se le paie.
const MODELE = process.env.BANC_MODELE || 'anthropic/claude-opus-5.5';

const acces: Acces = {
  baseUrl: 'https://openrouter.ai/api/v1',
  cle: process.env.OPENROUTER_API_KEY ?? '',
  modele: MODELE,
  fournisseurId: 'openrouter',
  raisonnement: (process.env.BANC_RAISONNEMENT || 'high') as 'low' | 'medium' | 'high',
};

const DOSSIER = resolve('banque/spectacles');
const TOUS = readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const RETENUS = DEMANDES.includes('tous') ? TOUS : TOUS.filter((id) => DEMANDES.includes(id));
if (DEMANDES.length > 0 && RETENUS.length === 0) {
  throw new Error(`BANC_ANNOTER=${DEMANDES.join(',')} ne désigne aucun modèle du fonds. `
    + `Modèles : ${TOUS.join(', ')}, ou « tous ».`);
}

const SchemaAnnotation = z.object({
  accords: z.array(z.object({
    cle: z.string(),
    // « féminin » s'écrit avec accent : on accepte les deux graphies.
    genreActuel: z.string()
      .transform((g) => g.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
      .pipe(z.enum(['masculin', 'feminin'])),
    remplacements: z.array(z.object({
      id: z.string(),
      avant: z.string().min(1),
      apres: z.string(),
    })),
  })),
  interactions: z.array(z.string()),
});

for (const id of TOUS) {
  const retenu = RETENUS.includes(id);
  test.skipIf(!retenu)(`annoter ${id}`, async () => {
    const chemin = join(DOSSIER, `${id}.json`);
    const modele = JSON.parse(readFileSync(chemin, 'utf8')) as SpectacleModele;

    const lignes = lignesModele(modele);
    const parId = new Map(lignes.map((l) => [l.id, l]));
    const adresses = modele.actes.flatMap((a) =>
      a.elements.filter((e) => e.type === 'adresse_public').map((e) => e.id));

    const prompts = promptAnnotationModele(
      modele.roles.map((r) => ({ cle: r.cle, genre: r.genre ?? null, espece: r.espece })),
      lignes.map((l) => ({ id: l.id, texte: l.lire() })),
      adresses,
    );

    /** Lit et vérifie une réponse ; rend l'annotation, ou la faute à corriger. */
    const verifier = (texte: string): { ok: true; lu: z.infer<typeof SchemaAnnotation> } | { ok: false; faute: string } => {
      const extrait = extraireJson(texte);
      if (!extrait.ok) return { ok: false, faute: `réponse illisible : ${extrait.erreur}` };
      const parse = SchemaAnnotation.safeParse(extrait.valeur);
      if (!parse.success) return { ok: false, faute: parse.error.issues.map((i) => i.message).join(' ; ') };
      const lu = parse.data;

      for (const role of modele.roles) {
        const a = lu.accords.find((x) => x.cle === role.cle);
        if (!a) return { ok: false, faute: `le rôle ${role.cle} manque dans « accords »` };
        if (role.genre && a.genreActuel !== role.genre) {
          return { ok: false, faute: `rôle ${role.cle} : genre lu « ${a.genreActuel} », le fonds dit « ${role.genre} »` };
        }
        for (const r of a.remplacements) {
          const ligne = parId.get(r.id);
          if (!ligne) return { ok: false, faute: `rôle ${role.cle} : ligne inconnue « ${r.id} »` };
          if (!ligne.lire().includes(r.avant)) {
            return {
              ok: false,
              faute: `rôle ${role.cle} : « avant » introuvable dans [${r.id}] : « ${r.avant} » — recopie l'extrait EXACTEMENT depuis la ligne, guillemets et espaces compris`,
            };
          }
        }
      }
      const attendu = [...adresses].sort();
      const recu = [...lu.interactions].sort();
      if (JSON.stringify(attendu) !== JSON.stringify(recu)) {
        return {
          ok: false,
          faute: `le classement « interactions » doit contenir exactement ${attendu.join(', ') || '(rien)'}, reçu : ${recu.join(', ') || '(rien)'}`,
        };
      }
      return { ok: true, lu };
    };

    // Un extrait mal recopié ou un genre hors format se corrige en renvoyant
    // la faute précise : une relance, comme le pipeline avec le JSON invalide.
    let resultat = verifier((await appelerModele(
      acces,
      [{ role: 'system', content: prompts.system }, { role: 'user', content: prompts.user }],
      { temperature: 0, maxTokens: 32000 },
    )).texte);
    if (!resultat.ok) {
      console.warn(`  ${id} : relance — ${resultat.faute}`);
      resultat = verifier((await appelerModele(
        acces,
        [
          { role: 'system', content: prompts.system },
          {
            role: 'user',
            content: `${prompts.user}\n\nTa réponse précédente était invalide : ${resultat.faute}.\n`
              + 'Renvoie l’objet JSON complet et corrigé.',
          },
        ],
        { temperature: 0, maxTokens: 32000 },
      )).texte);
    }
    if (!resultat.ok) throw new Error(resultat.faute);
    const lu = resultat.lu;

    // Écriture : le genre (s'il manquait), les accords vers l'autre genre,
    // le classement des interactions.
    for (const role of modele.roles) {
      const a = lu.accords.find((x) => x.cle === role.cle)!;
      role.genre = role.genre ?? a.genreActuel;
      role.accords = {
        vers: role.genre === 'masculin' ? 'feminin' : 'masculin',
        remplacements: a.remplacements,
      };
    }
    modele.interactionsOrdonnees = lu.interactions;

    writeFileSync(chemin, `${JSON.stringify(modele, null, 2)}\n`);
    const nb = modele.roles.reduce((s, r) => s + (r.accords?.remplacements.length ?? 0), 0);
    console.log(`  ${id} : ${nb} remplacement(s) d'accords, ${lu.interactions.length} interaction(s) classée(s).`
      + '\n  Penser à réindexer : npm run banque');
  });
}
