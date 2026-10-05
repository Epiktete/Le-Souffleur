// Réglages du fournisseur d'IA, et gestion de la clé (CDC §5 et §10).
//
// Règle de sécurité, tenue strictement :
//   - la clé n'est enregistrée dans IndexedDB QUE si l'utilisateur a coché
//     « Mémoriser la clé sur cet appareil » (décoché par défaut) ;
//   - sinon elle ne vit qu'en mémoire, le temps de la visite ;
//   - elle n'est jamais écrite dans un journal, jamais incluse dans un export,
//     jamais affichée en clair.

import { ecrireReglage, lireReglage, oublierReglage } from '../services/db';
import { prereglage, type Acces } from '../services/connecteurIa';
import type { ReglagesIa } from '../types';

/** État de la clé, affiché dans l'en-tête (CDC §7). */
export type EtatCle = 'absente' | 'ok';

function creerReglagesIa() {
  const defaut = prereglage('openrouter');

  let fournisseurId = $state(defaut.id);
  let baseUrl = $state(defaut.baseUrl);
  let modele = $state(defaut.modeleSuggere);
  /** La clé vit ici, en mémoire. Elle ne descend au stockage que si demandé. */
  let cle = $state('');
  let memoriser = $state(false);
  let chargee = $state(false);
  /** Les clés des autres fournisseurs, le temps de la visite : jamais stockées. */
  const clesMisesDeCote = new Map<string, string>();

  return {
    get fournisseurId() { return fournisseurId; },
    get baseUrl() { return baseUrl; },
    get modele() { return modele; },
    get cle() { return cle; },
    get memoriser() { return memoriser; },
    get chargee() { return chargee; },

    get etat(): EtatCle { return cle.trim() ? 'ok' : 'absente'; },
    get pretPourGenerer() {
      return !!cle.trim() && !!baseUrl.trim() && !!modele.trim();
    },

    /** Ce que le connecteur attend. */
    get acces(): Acces {
      return { fournisseurId, baseUrl: baseUrl.trim(), modele: modele.trim(), cle: cle.trim() };
    },

    async charger() {
      try {
        const enregistres = await lireReglage('ia');
        if (enregistres) {
          fournisseurId = enregistres.fournisseurId;
          baseUrl = enregistres.baseUrl;
          modele = enregistres.modele;
          // Une clé présente dans le stockage vient forcément d'un choix
          // explicite de mémorisation.
          if (enregistres.cle) {
            cle = enregistres.cle;
            memoriser = true;
          }
        }
      } catch (e) {
        console.error('Le Souffleur — réglages IA : échec de la lecture', e);
      } finally {
        chargee = true;
      }
    },

    /** Change de fournisseur : l'adresse et le modèle suivent le préréglage. */
    choisirFournisseur(id: string) {
      const p = prereglage(id);
      // UNE CLÉ PAR FOURNISSEUR. Une clé OpenRouter gardée en passant sur
      // OpenAI partait chez OpenAI dès le test de connexion ou la liste des
      // modèles. On la met de côté, en mémoire seulement, et on la retrouve si
      // l'on revient à ce fournisseur.
      if (id !== fournisseurId) {
        clesMisesDeCote.set(fournisseurId, cle);
        cle = clesMisesDeCote.get(id) ?? '';
      }
      fournisseurId = id;
      // « Autre » garde ce que l'utilisateur a saisi.
      if (p.baseUrl) baseUrl = p.baseUrl;
      if (p.modeleSuggere) modele = p.modeleSuggere;
    },

    definirBaseUrl(valeur: string) { baseUrl = valeur; },
    definirModele(valeur: string) { modele = valeur; },
    definirCle(valeur: string) { cle = valeur; },
    /**
     * La case agit TOUT DE SUITE sur la clé stockée. Elle n'agissait qu'au
     * clic sur « Enregistrer » : décocher puis repartir laissait la clé sur
     * l'appareil, alors que l'écran affirmait déjà le contraire. Seule la clé
     * est touchée ; les autres réglages attendent « Enregistrer ».
     */
    async definirMemoriser(valeur: boolean) {
      memoriser = valeur;
      try {
        const stockes = await lireReglage('ia');
        const base: ReglagesIa = stockes
          ? { fournisseurId: stockes.fournisseurId, baseUrl: stockes.baseUrl, modele: stockes.modele }
          : { fournisseurId, baseUrl: baseUrl.trim(), modele: modele.trim() };
        await ecrireReglage('ia', valeur && cle.trim() ? { ...base, cle: cle.trim() } : base);
      } catch (e) {
        console.error('Le Souffleur — réglages IA : échec de l’enregistrement', e);
        if (!valeur) await oublierReglage('ia').catch(() => {});
      }
    },

    /**
     * Enregistre les réglages. La clé n'y figure que si la mémorisation est
     * demandée ; dans le cas contraire, une clé déjà stockée est effacée.
     */
    async enregistrer(): Promise<boolean> {
      const aEcrire: ReglagesIa = {
        fournisseurId,
        baseUrl: baseUrl.trim(),
        modele: modele.trim(),
        ...(memoriser && cle.trim() ? { cle: cle.trim() } : {}),
      };
      try {
        await ecrireReglage('ia', aEcrire);
        return true;
      } catch (e) {
        console.error('Le Souffleur — réglages IA : échec de l’enregistrement', e);
        return false;
      }
    },

    /** Bouton « Oublier la clé » (CDC §5) : mémoire et stockage. */
    async oublierCle() {
      cle = '';
      clesMisesDeCote.clear();
      memoriser = false;
      try {
        await ecrireReglage('ia', {
          fournisseurId,
          baseUrl: baseUrl.trim(),
          modele: modele.trim(),
        });
      } catch {
        // Si l'écriture échoue, on retire l'entrée entière plutôt que de
        // laisser une clé derrière nous.
        await oublierReglage('ia').catch(() => {});
      }
    },
  };
}

export const reglagesIa = creerReglagesIa();
