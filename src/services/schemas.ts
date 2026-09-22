// Schémas zod des réponses attendues du modèle, un par étape du pipeline
// (CDC §6).
//
// Le format JSON est imposé par le prompt et vérifié ici : aucun fournisseur
// n'est digne de confiance sur ce point, et certains ignorent en silence les
// mécanismes de sortie structurée (raison pour laquelle le CDC §5 les interdit).
//
// Les schémas restent volontairement tolérants sur ce qui n'est pas vital
// (une description un peu longue passe) et stricts sur ce qui casserait
// l'application (un conte inconnu, un type d'élément inconnu, une main
// inexistante).

import { z } from 'zod';

/* ================================================================== */
/* Étape 1 : trois synopsis                                            */
/* ================================================================== */

/** Qui joue quoi, dans un synopsis. */
export const schemaRoleJoue = z.object({
  marionnette: z.string().min(1),
  /** Le nom du rôle, tel que la fiche du conte l'écrit. */
  role: z.string().min(1),
  /** Ce que le caractère de la marionnette apporte au rôle, en quelques mots. */
  note: z.string().default(''),
});

/**
 * Un synopsis, tel que le parent le lit sur sa carte.
 *
 * Les longueurs sont plafonnées ici plutôt que demandées en prose : une
 * longueur écrite dans un prompt est ignorée, une longueur dans un schéma
 * déclenche une relance.
 */
export const schemaSynopsis = z.object({
  /** Identifiant du conte dans le répertoire. */
  conte: z.string().min(1),
  titre: z.string().min(1).max(90),
  accroche: z.string().max(140).default(''),
  resume: z.array(z.string().min(1).max(220)).min(2).max(6),
  distribution: z.array(schemaRoleJoue).min(1),
  changements: z.array(z.string().min(1).max(260)).max(4).default([]),
});

/**
 * Un synopsis complété par l'application : un identifiant pour l'interface, et
 * la référence au conte d'origine, que le modèle n'a pas à recopier.
 */
export type Synopsis = z.infer<typeof schemaSynopsis> & {
  id: string;
  /** « D'après … » : titre, culture, source. Calculé depuis la fiche. */
  reference: string;
};

/**
 * La réponse de l'étape 1, vérifiée contre les contes réellement présentés et
 * les marionnettes réellement choisies.
 *
 * Le schéma est construit à chaque appel, parce que ce qui est valide dépend
 * de l'appel : un conte qui n'était pas dans la liste, deux synopsis sur le
 * même conte, une marionnette oubliée ou inventée sont des réponses fausses,
 * et le message d'erreur repart au modèle pour qu'il corrige.
 */
export function schemaSynopsisPour(contes: string[], marionnettes: string[]) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const noms = new Set(marionnettes.map(norm));
  return z.object({
    synopsis: z.array(schemaSynopsis).min(3).max(4),
  }).superRefine((v, ctx) => {
    const vus = new Set<string>();
    v.synopsis.forEach((s, i) => {
      if (!contes.includes(s.conte)) {
        ctx.addIssue({
          code: 'custom',
          path: ['synopsis', i, 'conte'],
          message: `« ${s.conte} » n'est pas dans la liste ; choisis parmi : ${contes.join(', ')}`,
        });
      }
      if (vus.has(s.conte)) {
        ctx.addIssue({ code: 'custom', path: ['synopsis', i, 'conte'], message: `« ${s.conte} » est proposé deux fois` });
      }
      vus.add(s.conte);
      // Le titre est celui du conte d'origine : jamais le nom d'une marionnette.
      // Un nom d'un seul mot (« Lapin ») peut être l'espèce du titre : il passe.
      const nomDansLeTitre = marionnettes.find((nom) =>
        nom.trim().includes(' ') && norm(s.titre).includes(norm(nom)));
      if (nomDansLeTitre) {
        ctx.addIssue({
          code: 'custom',
          path: ['synopsis', i, 'titre'],
          message: `le titre reprend celui du conte d'origine, sans « ${nomDansLeTitre} »`,
        });
      }
      const distribues = new Set(s.distribution.map((d) => norm(d.marionnette)));
      for (const nom of marionnettes) {
        if (!distribues.has(norm(nom))) {
          ctx.addIssue({
            code: 'custom',
            path: ['synopsis', i, 'distribution'],
            message: `${nom} n'a pas de rôle ; chaque marionnette doit en avoir un`,
          });
        }
      }
      for (const d of s.distribution) {
        if (!noms.has(norm(d.marionnette))) {
          ctx.addIssue({
            code: 'custom',
            path: ['synopsis', i, 'distribution'],
            message: `« ${d.marionnette} » n'est pas une marionnette du parent`,
          });
        }
      }
    });
  });
}

/* ================================================================== */
/* Passe 1 : la transposition                                          */
/* ================================================================== */

/**
 * Le texte intégral du conte, où les personnages sont devenus les
 * marionnettes. Il est la référence de toute la suite.
 */
export const schemaTransposition = z.object({
  texte: z.string().min(1),
  /** Les retouches autres qu'un nom : espèce, ce qui a mal vieilli, cruauté. */
  changements: z.array(z.string()).default([]),
});
export type Transposition = z.infer<typeof schemaTransposition>;

/* ================================================================== */
/* Passe 2 : le découpage en tableaux et en actes                      */
/* ================================================================== */

/** Les quatre mains possibles (CDC §4). */
export const schemaMainStricte = z.enum(['M1G', 'M1D', 'M2G', 'M2D']);

/**
 * Remet un code de main dans sa forme canonique.
 *
 * Le modèle écrit « m1g », « M1 G », « main gauche », « G ». La main n'est pas
 * une information que le modèle détient : l'application les RÉATTRIBUE de
 * toute façon (voir `attribuerMains`). Ce qui est lu ici n'est donc qu'une
 * indication de préférence, et une préférence illisible ne doit jamais coûter
 * un spectacle.
 */
export function normaliserMain(valeur: unknown): string {
  if (typeof valeur !== 'string') return 'M1G';
  const v = valeur.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^M[12][GD]$/.test(v)) return v;
  const marionnettiste = /2/.test(v) ? '2' : '1';
  if (v.includes('GAUCHE') || v === 'G' || v.endsWith('G')) return `M${marionnettiste}G`;
  if (v.includes('DROITE') || v === 'D' || v.endsWith('D')) return `M${marionnettiste}D`;
  return `M${marionnettiste}G`;
}

/** La main telle qu'on la lit : tolérante, puisqu'elle sera recalculée. */
export const schemaMain = z.preprocess(normaliserMain, schemaMainStricte);

/**
 * L'adaptation du conte choisi : ce qui change par rapport à lui, puis le
 * découpage en tableaux et en actes.
 */
export const schemaAdaptation = z.object({
  titre: z.string().min(1),
  pitch: z.string().default(''),
  /** Ce qui diffère du conte d'origine, et pourquoi, une phrase chacun. */
  changements: z.array(z.string().min(1)).default([]),
  tableaux: z
    .array(
      z.object({
        id: z.string().min(1),
        titre: z.string().min(1),
        description: z.string().default(''),
        accessoires: z.array(z.string()).default([]),
        /** Plus demandé au modèle ; toléré s'il le renvoie. */
        promptImage: z.string().default(''),
      }),
    )
    .min(1)
    .max(4),
  actes: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        titre: z.string().min(1),
        tableauId: z.string().min(1),
        resume: z.string().default(''),
        /** La partie du conte que joue cet acte, par ses premiers et derniers mots. */
        passage: z.string().default(''),
        /** Déroulé en quelques temps. */
        temps: z.array(z.string()).default([]),
        /** Entrées et sorties prévues, avec la main. */
        mouvements: z
          .array(
            z.object({
              type: z.enum(['entree', 'sortie']),
              marionnette: z.string().min(1),
              main: schemaMain,
            }),
          )
          .default([]),
        momentsPublic: z.array(z.string()).default([]),
        budgetMots: z.number().int().min(0).default(0),
      }),
    )
    .min(1)
    // Cinq actes au lieu de quatre ne casse rien : le contrôle de durée le
    // dira, et le parent peut couper. Refuser toute la génération, si.
    .max(6),
});
export type Adaptation = z.infer<typeof schemaAdaptation>;

/** Ce dont la simulation de scène a besoin : les actes et leurs mouvements. */
export type Conduite = Pick<Adaptation, 'actes'>;

/* ================================================================== */
/* Étape 4 : écriture d'un acte                                        */
/* ================================================================== */

/**
 * Les éléments d'un acte.
 *
 * Le modèle désigne les marionnettes par leur NOM, pas par leur identifiant :
 * lui demander de recopier des UUID est une source d'erreurs inutile.
 * La conversion en identifiants est faite par l'application.
 */
export const schemaElementEcrit = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('replique'),
    marionnette: z.string().min(1),
    texte: z.string().min(1),
    ton: z.string().optional(),
  }),
  z.object({
    type: z.literal('didascalie'),
    texte: z.string().min(1),
  }),
  z.object({
    type: z.literal('adresse_public'),
    marionnette: z.string().min(1),
    texte: z.string().min(1),
    attenteReponse: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('note_marionnettiste'),
    texte: z.string().min(1),
  }),
  z.object({
    type: z.literal('entree'),
    marionnette: z.string().min(1),
    main: schemaMain,
  }),
  z.object({
    type: z.literal('sortie'),
    marionnette: z.string().min(1),
    main: schemaMain,
  }),
]);
export type ElementEcrit = z.infer<typeof schemaElementEcrit>;

export const schemaActeEcrit = z.object({
  elements: z.array(schemaElementEcrit).min(1),
});
export type ActeEcrit = z.infer<typeof schemaActeEcrit>;

/* ================================================================== */
/* Étape 6 : relecture                                                 */
/* ================================================================== */

/**
 * Un numéro d'acte ou d'élément tel que le modèle l'écrit : 0, -1, « 2 »,
 * null ou rien. Un problème qui concerne tout le spectacle n'a pas de numéro,
 * et certains modèles écrivent alors 0. Ce qui n'est pas un entier positif
 * devient « pas de numéro » : le problème vaut pour tout le spectacle.
 */
const numeroTolerant = z.preprocess((v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : undefined;
}, z.number().int().min(1).optional());

/** Une gravité inconnue ne casse rien : elle compte comme un détail. */
const graviteTolerante = z.preprocess((v) => {
  const g = typeof v === 'string' ? v.toLowerCase().trim() : '';
  return ['bloquant', 'important', 'mineur'].includes(g) ? g : 'mineur';
}, z.enum(['bloquant', 'important', 'mineur']));

/**
 * La revue du directeur éditorial : ses remarques, chacune avec la
 * modification qu'il propose. Les anciens noms de champs (problemes,
 * probleme, correction) restent acceptés : certains modèles s'y accrochent.
 */
const remarqueTolerante = z.preprocess(
  (v) => {
    if (!v || typeof v !== 'object') return v;
    const o = v as Record<string, unknown>;
    return { ...o, remarque: o.remarque ?? o.probleme, modification: o.modification ?? o.correction };
  },
  z.object({
    acte: numeroTolerant,
    element: numeroTolerant,
    gravite: graviteTolerante,
    remarque: z.string().min(1),
    modification: z.string().default(''),
  }),
);

export const schemaRelecture = z.preprocess(
  (v) => {
    if (!v || typeof v !== 'object') return v;
    const o = v as Record<string, unknown>;
    return { remarques: o.remarques ?? o.problemes };
  },
  z.object({ remarques: z.array(remarqueTolerante).default([]) }),
);
export type Relecture = z.infer<typeof schemaRelecture>;

/**
 * Valide une valeur contre un schéma et renvoie un message français utilisable
 * pour relancer le modèle, qui a besoin de savoir précisément ce qui cloche.
 */
export function valider<T>(
  schema: z.ZodType<T>,
  valeur: unknown,
): { ok: true; valeur: T } | { ok: false; erreur: string } {
  const r = schema.safeParse(valeur);
  if (r.success) return { ok: true, valeur: r.data };

  const details = r.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || 'racine'} : ${i.message}`)
    .join(' ; ');
  return { ok: false, erreur: details };
}
