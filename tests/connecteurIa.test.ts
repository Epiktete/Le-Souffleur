// Connecteur IA : lecture des réponses et traduction des erreurs (CDC §5 et §6).
//
// Ces cas viennent des réponses réellement observées à l'étape 0, y compris la
// particularité de Google Gemini qui répond 400 au lieu de 401.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extraireJson } from '../src/services/jsonLlm';
import {
  appelerModele,
  ErreurIa,
  PREREGLAGES,
  prereglage,
  testerConnexion,
  type Acces,
} from '../src/services/connecteurIa';
import { t, tt } from '../src/textes';

describe('extraireJson', () => {
  it('lit un objet nu', () => {
    const r = extraireJson('{"ok": true}');
    expect(r.ok && r.valeur).toEqual({ ok: true });
  });

  it('retire les balises de code', () => {
    const r = extraireJson('```json\n{"ok": true}\n```');
    expect(r.ok && r.valeur).toEqual({ ok: true });
  });

  it('ignore le bavardage avant et après', () => {
    const r = extraireJson('Voici le résultat :\n{"ok": true}\nBonne lecture !');
    expect(r.ok && r.valeur).toEqual({ ok: true });
  });

  it('ne se laisse pas tromper par une accolade dans une chaîne', () => {
    const r = extraireJson('{"texte": "il a dit } puis rien", "ok": true}');
    expect(r.ok && (r.valeur as { ok: boolean }).ok).toBe(true);
  });

  it('gère les guillemets échappés', () => {
    const r = extraireJson('{"texte": "il a dit \\"bonjour\\"", "ok": true}');
    expect(r.ok && (r.valeur as { texte: string }).texte).toBe('il a dit "bonjour"');
  });

  it('garde les objets imbriqués entiers', () => {
    const r = extraireJson('{"a": {"b": {"c": 1}}, "ok": true}');
    expect(r.ok && r.valeur).toEqual({ a: { b: { c: 1 } }, ok: true });
  });

  it('signale un JSON tronqué', () => {
    const r = extraireJson('{"ok": true, "texte": "coupé au milieu');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erreur).toContain('tronqué');
  });

  it('signale l’absence de JSON', () => {
    const r = extraireJson('Je ne sais pas faire cela.');
    expect(r.ok).toBe(false);
  });

  it('signale un JSON mal formé', () => {
    const r = extraireJson('{"ok": true,,}');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erreur).toContain('mal formé');
  });

  it('ne plante pas sur une réponse vide', () => {
    expect(extraireJson('').ok).toBe(false);
    expect(extraireJson('   ').ok).toBe(false);
  });
});

describe('préréglages', () => {
  it('contient les six fournisseurs du CDC §5', () => {
    expect(PREREGLAGES.map((p) => p.id)).toEqual([
      'openrouter', 'openai', 'mistral', 'gemini', 'anthropic', 'autre',
    ]);
  });

  it('propose OpenRouter par défaut, avec le modèle retenu', () => {
    expect(prereglage('openrouter').modeleSuggere).toBe('openai/gpt-5.6-sol');
  });

  it('retombe sur OpenRouter pour un identifiant inconnu', () => {
    expect(prereglage('inexistant').id).toBe('openrouter');
  });
});

const acces: Acces = {
  fournisseurId: 'openrouter',
  baseUrl: 'https://exemple.test/v1',
  modele: 'un-modele',
  cle: 'cle-de-test',
};

/** Remplace fetch par une réponse fabriquée. */
function simulerReponse(statut: number, corps: unknown, enTete = true) {
  const texte = typeof corps === 'string' ? corps : JSON.stringify(corps);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(texte, {
      status: statut,
      headers: enTete ? { 'Content-Type': 'application/json' } : {},
    })),
  );
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('appelerModele : corps de la requête', () => {
  it('n’envoie jamais les champs interdits par le CDC §5', async () => {
    const espion = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', espion);

    await appelerModele(acces, [{ role: 'user', content: 'salut' }], {
      temperature: 0.5,
      maxTokens: 100,
    });

    const corps = JSON.parse(espion.mock.calls[0][1].body as string);
    // Le format JSON est imposé par le prompt, jamais par ces champs.
    expect(corps).not.toHaveProperty('response_format');
    expect(corps).not.toHaveProperty('tools');
    expect(corps).not.toHaveProperty('strict');
    expect(corps).not.toHaveProperty('seed');
    // Pas de streaming en V1.
    expect(corps.stream).toBeUndefined();
    // Ce qui doit y être.
    expect(corps.model).toBe('un-modele');
    expect(corps.temperature).toBe(0.5);
    expect(corps.max_tokens).toBe(100);
  });

  it('ajoute l’en-tête navigateur pour Anthropic seulement', async () => {
    const espion = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', espion);

    await appelerModele({ ...acces, fournisseurId: 'anthropic' }, [], {
      temperature: 0, maxTokens: 10,
    });
    const avec = espion.mock.calls[0][1].headers as Record<string, string>;
    expect(avec['anthropic-dangerous-direct-browser-access']).toBe('true');

    await appelerModele(acces, [], { temperature: 0, maxTokens: 10 });
    const sans = espion.mock.calls[1][1].headers as Record<string, string>;
    expect(sans['anthropic-dangerous-direct-browser-access']).toBeUndefined();
  });

  it('n’ajoute pas de double barre oblique à l’adresse', async () => {
    const espion = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', espion);
    await appelerModele({ ...acces, baseUrl: 'https://exemple.test/v1/' }, [], {
      temperature: 0, maxTokens: 10,
    });
    expect(espion.mock.calls[0][0]).toBe('https://exemple.test/v1/chat/completions');
  });
});

describe('appelerModele : messages d’erreur du CDC §5', () => {
  it('401 : la clé est refusée', async () => {
    simulerReponse(401, { error: { message: 'Invalid key' } });
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.cleRefusee);
  });

  it('403 : la clé est refusée', async () => {
    simulerReponse(403, {});
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.cleRefusee);
  });

  it('400 avec « api key » : la clé est refusée, cas de Google Gemini', async () => {
    // Constat de l'étape 0 : Gemini répond 400 là où les autres répondent 401.
    simulerReponse(400, [{ error: { code: 400, message: 'Please pass a valid API key' } }]);
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.cleRefusee);
  });

  it('400 sans mention de clé : message générique, pas « clé refusée »', async () => {
    simulerReponse(400, { error: { message: 'unknown model xyz' } });
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(/erreur 400/);
  });

  it('402 : crédit épuisé', async () => {
    simulerReponse(402, {});
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.creditEpuise);
  });

  it('un message de crédit insuffisant est reconnu même sans 402', async () => {
    simulerReponse(500, { error: { message: 'Insufficient credits remaining' } });
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.creditEpuise);
  });

  it('429 : trop de demandes', async () => {
    simulerReponse(429, {});
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.tropDeDemandes);
  });

  it('TypeError sur fetch : le fournisseur bloque le navigateur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.navigateurBloque);
  });

  it('annulation par l’utilisateur : message dédié, pas une erreur de réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, o: RequestInit) => {
      await new Promise((_, ko) => {
        o.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          ko(e);
        });
      });
      return new Response('');
    }));

    const controleur = new AbortController();
    const promesse = appelerModele(acces, [], {
      temperature: 0, maxTokens: 10, signal: controleur.signal,
    });
    controleur.abort();
    await expect(promesse).rejects.toThrow(t.erreursIa.annule);
  });

  it('une réponse qui n’est pas du Chat Completions est signalée', async () => {
    simulerReponse(200, { quelque_chose: 'autre' });
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.reponseIncomprehensible);
  });

  it('remonte la consommation de jetons quand elle est fournie', async () => {
    simulerReponse(200, {
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 45, completion_tokens: 13, total_tokens: 58 },
    });
    const r = await appelerModele(acces, [], { temperature: 0, maxTokens: 10 });
    expect(r.jetons).toEqual({ entree: 45, sortie: 13, total: 58 });
  });
});

describe('testerConnexion : les trois points du CDC §5', () => {
  it('tout vert quand le modèle renvoie le JSON demandé', async () => {
    simulerReponse(200, {
      choices: [{ message: { content: '```json\n{"ok": true, "couleur": "rouge"}\n```' } }],
      usage: { total_tokens: 58 },
    });
    const r = await testerConnexion(acces);
    expect(r).toMatchObject({ cleAcceptee: true, appelPossible: true, jsonValide: true });
    expect(r.message).toBe(tt.succes);
    expect(r.jetons?.total).toBe(58);
  });

  it('clé acceptée mais format refusé quand le modèle bavarde', async () => {
    simulerReponse(200, {
      choices: [{ message: { content: 'Bien sûr ! Voici : ok, la couleur est rouge.' } }],
    });
    const r = await testerConnexion(acces);
    expect(r).toMatchObject({ cleAcceptee: true, appelPossible: true, jsonValide: false });
    expect(r.message).toBe(t.erreursIa.jsonInvalide);
  });

  it('clé refusée : l’appel reste possible, c’est la clé qui est en cause', async () => {
    simulerReponse(401, {});
    const r = await testerConnexion(acces);
    expect(r).toMatchObject({ cleAcceptee: false, appelPossible: true, jsonValide: false });
    expect(r.message).toBe(t.erreursIa.cleRefusee);
  });

  it('navigateur bloqué : on ne peut rien dire de la clé', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const r = await testerConnexion(acces);
    expect(r).toMatchObject({ cleAcceptee: false, appelPossible: false, jsonValide: false });
  });

  it('ne renvoie jamais la clé dans son résultat', async () => {
    simulerReponse(401, { error: { message: 'Incorrect API key: cle-de-test' } });
    const r = await testerConnexion(acces);
    // Le message affiché est le nôtre, jamais celui du fournisseur.
    expect(JSON.stringify(r)).not.toContain('cle-de-test');
  });
});

describe('réponse tronquée : le piège des modèles à raisonnement', () => {
  it('signale une réponse coupée par le budget de jetons', async () => {
    simulerReponse(200, {
      choices: [{ message: { content: '{"ok": true, "coupe' }, finish_reason: 'length' }],
    });
    const r = await appelerModele(acces, [], { temperature: 0, maxTokens: 10 });
    expect(r.tronquee).toBe(true);
    expect(r.motifArret).toBe('length');
  });

  it('ne confond pas une fin normale avec une troncature', async () => {
    simulerReponse(200, {
      choices: [{ message: { content: '{"ok": true}' }, finish_reason: 'stop' }],
    });
    const r = await appelerModele(acces, [], { temperature: 0, maxTokens: 10 });
    expect(r.tronquee).toBe(false);
  });

  it('traite une réponse vide coupée comme une troncature, pas comme une réponse incomprise', async () => {
    // Un modèle à raisonnement peut consommer tout son budget en réflexion et
    // ne renvoyer aucun texte.
    simulerReponse(200, {
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
      usage: { completion_tokens: 2000 },
    });
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.reponseTronquee);
  });

  it('accepte le motif d’arrêt natif quand finish_reason est absent', async () => {
    simulerReponse(200, {
      choices: [{ message: { content: '{"ok": true}' }, native_finish_reason: 'max_tokens' }],
    });
    const r = await appelerModele(acces, [], { temperature: 0, maxTokens: 10 });
    expect(r.tronquee).toBe(true);
  });

  it('une réponse vide sans troncature reste une réponse incomprise', async () => {
    simulerReponse(200, { choices: [{ message: { content: '' }, finish_reason: 'stop' }] });
    await expect(appelerModele(acces, [], { temperature: 0, maxTokens: 10 }))
      .rejects.toThrow(t.erreursIa.reponseIncomprehensible);
  });
});

describe('ErreurIa', () => {
  it('porte le statut HTTP quand il existe', async () => {
    simulerReponse(429, {});
    try {
      await appelerModele(acces, [], { temperature: 0, maxTokens: 10 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurIa);
      expect((e as ErreurIa).statut).toBe(429);
    }
  });
});
