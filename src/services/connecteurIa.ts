// Connecteur IA unique, au format « Chat Completions » compatible OpenAI
// (CDC §5).
//
// L'interface n'appelle JAMAIS ce module directement : elle passe par les
// services. C'est ce qui permettra d'ajouter un proxy serveur en V2 sans
// toucher aux écrans (CDC §3).
//
// Deux règles tenues strictement :
//   - on ne dépend que du plus petit dénominateur commun entre fournisseurs :
//     pas de `response_format`, `tools`, `strict` ni `seed`, ignorés en silence
//     par certains d'entre eux. Le format JSON est imposé par le prompt et
//     vérifié par l'application ;
//   - pas de streaming en V1 : la progression est affichée par étape.
//
// La liste des préréglages et leurs particularités viennent de l'étape 0, où
// chacun a été appelé depuis un vrai navigateur.

import { IA } from '../config';
import { t, tt } from '../textes';
import { extraireJson } from './jsonLlm';

/** Un préréglage de fournisseur (CDC §5). */
export interface Prereglage {
  id: string;
  nom: string;
  baseUrl: string;
  /** Modèle proposé par défaut pour ce fournisseur. */
  modeleSuggere: string;
  /** Précision affichée sous le nom, si nécessaire. */
  note?: string;
  /** Adresse de la page où créer une clé, pour le guide pas à pas (CDC §10). */
  urlCle?: string;
}

/**
 * Les six préréglages du CDC §5.
 * Tous ont passé le test de l'étape 0 : appel possible depuis un navigateur et
 * liste des modèles accessible. Aucun n'est donc marqué « expérimental ».
 */
export const PREREGLAGES: Prereglage[] = [
  {
    id: 'openrouter',
    nom: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modeleSuggere: 'openai/gpt-5.6-sol',
    note: 'le plus simple : une seule clé pour tous les modèles',
    urlCle: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'openai',
    nom: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modeleSuggere: 'gpt-5.6-sol',
    urlCle: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'mistral',
    nom: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    modeleSuggere: 'mistral-large-latest',
    urlCle: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'gemini',
    nom: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modeleSuggere: 'gemini-2.5-flash',
    urlCle: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'anthropic',
    nom: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modeleSuggere: 'claude-haiku-4-5-20251001',
    note: 'couche de compatibilité, non destinée à la production',
    urlCle: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'autre',
    nom: 'Autre',
    baseUrl: '',
    modeleSuggere: '',
    note: 'pour un service local comme Ollama, ou tout service compatible',
  },
];

export function prereglage(id: string): Prereglage {
  return PREREGLAGES.find((p) => p.id === id) ?? PREREGLAGES[0];
}

/** Ce qu'il faut pour appeler un fournisseur. */
export interface Acces {
  baseUrl: string;
  cle: string;
  modele: string;
  /** Identifiant du préréglage, qui détermine les en-têtes particuliers. */
  fournisseurId: string;
}

/** Erreur d'appel, déjà traduite pour l'utilisateur. */
export class ErreurIa extends Error {
  constructor(
    message: string,
    /** Cause technique, pour le journal. Ne contient jamais la clé. */
    readonly cause?: unknown,
    readonly statut?: number,
  ) {
    super(message);
    this.name = 'ErreurIa';
  }
}

/** Consommation renvoyée par le fournisseur, quand il la renvoie (CDC §10). */
export interface Jetons {
  entree?: number;
  sortie?: number;
  total?: number;
}

export interface ReponseIa {
  /** Texte brut renvoyé par le modèle. */
  texte: string;
  jetons?: Jetons;
  /** Durée de l'appel, en millisecondes. */
  latenceMs: number;
  /**
   * Vrai si le fournisseur a coupé la réponse faute de budget de jetons.
   *
   * Le cas est fréquent avec les modèles à raisonnement : leurs jetons de
   * réflexion sont décomptés du même budget que le texte produit, si bien
   * qu'une réponse peut s'arrêter au milieu du JSON. Il faut le distinguer
   * d'un modèle qui écrit mal : le remède n'est pas le même.
   */
  tronquee: boolean;
  /** Motif d'arrêt renvoyé par le fournisseur, pour le journal. */
  motifArret?: string;
}

function entetes(acces: Acces): HeadersInit {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${acces.cle}`,
  };
  // Vérifié à l'étape 0 : l'endpoint Anthropic autorise explicitement cet
  // en-tête au contrôle préalable (preflight).
  if (acces.fournisseurId === 'anthropic') {
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  return h;
}

/**
 * Traduit une réponse d'erreur en message français (tableau du CDC §5).
 *
 * Google Gemini répond 400 « Please pass a valid API key » là où les autres
 * répondent 401 : on regarde donc aussi le corps du message. Constat de
 * l'étape 0.
 */
function messageErreur(statut: number, corps: string): string {
  const bas = corps.toLowerCase();
  const cleRefusee =
    statut === 401
    || statut === 403
    || (statut === 400 && /api[ _-]?key|authentication/.test(bas));

  if (cleRefusee) return t.erreursIa.cleRefusee;
  if (statut === 402 || /credit|quota|insufficient|billing/.test(bas)) {
    return t.erreursIa.creditEpuise;
  }
  if (statut === 429) return t.erreursIa.tropDeDemandes;
  return t.erreursIa.erreurFournisseur(statut);
}

/**
 * Envoie un appel au fournisseur et renvoie le texte du modèle.
 *
 * @param signal permet à l'utilisateur d'annuler ; un délai de 120 s (CDC §5)
 *               est appliqué en plus, quoi qu'il arrive.
 */
export async function appelerModele(
  acces: Acces,
  messages: { role: 'system' | 'user'; content: string }[],
  options: { temperature: number; maxTokens: number; signal?: AbortSignal },
): Promise<ReponseIa> {
  const minuteur = new AbortController();
  let delaiDepasse = false;
  const chrono = setTimeout(() => {
    delaiDepasse = true;
    minuteur.abort();
  }, IA.delaiMs);

  // On combine l'annulation de l'utilisateur et le délai maximal.
  const signal = options.signal
    ? AbortSignal.any([options.signal, minuteur.signal])
    : minuteur.signal;

  const debut = performance.now();
  try {
    const reponse = await fetch(`${acces.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: entetes(acces),
      signal,
      body: JSON.stringify({
        model: acces.modele,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    const corps = await reponse.text();
    if (!reponse.ok) {
      throw new ErreurIa(messageErreur(reponse.status, corps), undefined, reponse.status);
    }

    let enveloppe: {
      choices?: {
        message?: { content?: string };
        finish_reason?: string;
        native_finish_reason?: string;
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    try {
      enveloppe = JSON.parse(corps);
    } catch {
      throw new ErreurIa(t.erreursIa.reponseIncomprehensible);
    }

    const choix = enveloppe.choices?.[0];
    const texte = choix?.message?.content;
    const motifArret = choix?.finish_reason ?? choix?.native_finish_reason;
    const tronquee = motifArret === 'length' || motifArret === 'max_tokens';

    // Un modèle à raisonnement peut épuiser tout son budget en réflexion et ne
    // renvoyer aucun texte : c'est une troncature, pas une réponse incomprise.
    if (typeof texte !== 'string' || texte.trim() === '') {
      if (tronquee) {
        throw new ErreurIa(t.erreursIa.reponseTronquee, { motifArret, usage: enveloppe.usage });
      }
      throw new ErreurIa(t.erreursIa.reponseIncomprehensible, { motifArret });
    }

    return {
      texte,
      tronquee,
      motifArret,
      latenceMs: Math.round(performance.now() - debut),
      jetons: enveloppe.usage
        ? {
            entree: enveloppe.usage.prompt_tokens,
            sortie: enveloppe.usage.completion_tokens,
            total: enveloppe.usage.total_tokens,
          }
        : undefined,
    };
  } catch (e) {
    if (e instanceof ErreurIa) throw e;
    if ((e as Error).name === 'AbortError') {
      throw new ErreurIa(delaiDepasse ? t.erreursIa.delaiDepasse : t.erreursIa.annule);
    }
    // Une TypeError sur fetch signifie qu'aucune réponse n'est arrivée :
    // CORS refusé, ou pas de réseau (constat de l'étape 0).
    throw new ErreurIa(t.erreursIa.navigateurBloque, e);
  } finally {
    clearTimeout(chrono);
  }
}

/**
 * Tente de récupérer la liste des modèles du fournisseur (CDC §5).
 * Renvoie une liste vide en cas d'échec : l'interface retombe alors sur un
 * champ de saisie libre.
 */
export async function listerModeles(acces: Acces): Promise<string[]> {
  try {
    const reponse = await fetch(`${acces.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: entetes(acces),
    });
    if (!reponse.ok) return [];
    const j = (await reponse.json()) as { data?: { id?: string }[] };
    const ids = (j.data ?? []).map((m) => m.id).filter((id): id is string => !!id);
    return ids.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** Résultat du bouton « Tester la connexion », en trois points (CDC §5). */
export interface ResultatTest {
  cleAcceptee: boolean;
  appelPossible: boolean;
  jsonValide: boolean;
  /** Message à afficher : succès, ou cause de l'échec. */
  message: string;
  latenceMs?: number;
  jetons?: Jetons;
}

/**
 * Envoie une requête minimale qui demande un petit objet JSON, et rend compte
 * en trois points : clé acceptée, appel possible depuis ce navigateur, JSON
 * valide renvoyé (CDC §5).
 */
export async function testerConnexion(acces: Acces): Promise<ResultatTest> {
  const echec = (message: string, appelPossible = true): ResultatTest => ({
    cleAcceptee: false,
    appelPossible,
    jsonValide: false,
    message,
  });

  try {
    const reponse = await appelerModele(
      acces,
      [
        {
          role: 'system',
          content: 'Tu réponds uniquement par un objet JSON valide, sans aucun texte autour.',
        },
        {
          role: 'user',
          content: 'Renvoie exactement cet objet : {"ok": true, "couleur": "rouge"}',
        },
      ],
      { temperature: 0.2, maxTokens: 200 },
    );

    const extrait = extraireJson(reponse.texte);
    const conforme =
      extrait.ok
      && typeof extrait.valeur === 'object'
      && extrait.valeur !== null
      && (extrait.valeur as { ok?: unknown }).ok === true;

    return {
      cleAcceptee: true,
      appelPossible: true,
      jsonValide: conforme,
      message: conforme ? tt.succes : t.erreursIa.jsonInvalide,
      latenceMs: reponse.latenceMs,
      jetons: reponse.jetons,
    };
  } catch (e) {
    const erreur = e as ErreurIa;
    // Sans réponse du tout, on ne peut rien dire de la clé.
    const appelPossible = erreur.message !== t.erreursIa.navigateurBloque;
    return echec(erreur.message, appelPossible);
  }
}
