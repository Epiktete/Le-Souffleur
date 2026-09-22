<script lang="ts">
  // Les réglages du studio (CDC §7) : durée, âge, nombre de marionnettistes,
  // niveau d'interaction avec le public.
  //
  // Les curseurs suivent la charte §11 : piste encre de 4 px, poignée carrée,
  // valeur affichée en mono.
  import { BORNES } from '../config';
  import { ts } from '../textes';
  import { studio } from '../etat/studio.svelte';
  import type { NiveauInteraction } from '../types';

  const niveaux: [NiveauInteraction, string][] = [
    ['aucune', ts.reglages.interactionAucune],
    ['quelques', ts.reglages.interactionQuelques],
    ['beaucoup', ts.reglages.interactionBeaucoup],
  ];
</script>

<div class="reglages" data-visite="reglages">
  <!-- Durée -->
  <div class="reglage">
    <label for="r-duree" class="mono">{ts.reglages.duree}</label>
    <div class="curseur">
      <input
        id="r-duree"
        type="range"
        min={BORNES.dureeMinutes.min}
        max={BORNES.dureeMinutes.max}
        step="1"
        value={studio.valeurs.dureeMinutes}
        oninput={(e) => studio.definirDuree(Number(e.currentTarget.value))}
      />
      <output class="mono valeur" for="r-duree">
        {ts.reglages.dureeValeur(studio.valeurs.dureeMinutes)}
      </output>
    </div>
  </div>

  <!-- Âge de l'auditoire -->
  <div class="reglage">
    <label for="r-age" class="mono">{ts.reglages.age}</label>
    <div class="curseur">
      <input
        id="r-age"
        type="range"
        min={BORNES.ageAuditoire.min}
        max={BORNES.ageAuditoire.max}
        step="1"
        value={studio.valeurs.ageAuditoire}
        oninput={(e) => studio.definirAge(Number(e.currentTarget.value))}
      />
      <output class="mono valeur" for="r-age">
        {ts.reglages.ageValeur(studio.valeurs.ageAuditoire)}
      </output>
    </div>
  </div>

  <!--
    Marionnettistes et interaction partagent une ligne : ce sont deux choix
    courts, et les mettre côte à côte raccourcit la colonne du studio.
    Ils repassent l'un sous l'autre quand la largeur ne suffit plus.
  -->
  <div class="paire">
    <!-- Marionnettistes : 1 ou 2, donc 2 ou 4 mains -->
    <div class="reglage">
      <span class="mono" id="r-marionnettistes">{ts.reglages.marionnettistes}</span>
      <div class="choix" role="group" aria-labelledby="r-marionnettistes">
        {#each [1, 2] as const as nb (nb)}
          <button
            type="button"
            class:actif={studio.valeurs.nbMarionnettistes === nb}
            aria-pressed={studio.valeurs.nbMarionnettistes === nb}
            onclick={() => studio.definirMarionnettistes(nb)}
          >{nb}</button>
        {/each}
      </div>
    </div>

    <!-- Interaction avec le public ; la valeur par défaut est déduite de l'âge -->
    <div class="reglage">
      <span class="mono" id="r-interaction">{ts.reglages.interaction}</span>
      <div class="choix" role="group" aria-labelledby="r-interaction">
        {#each niveaux as [valeur, libelle] (valeur)}
          <button
            type="button"
            class:actif={studio.valeurs.interactionPublic === valeur}
            aria-pressed={studio.valeurs.interactionPublic === valeur}
            onclick={() => studio.definirInteraction(valeur)}
          >{libelle}</button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .reglages { display: grid; gap: 16px; }
  .reglage > label, .reglage > span.mono { display: block; margin-bottom: 6px; }

  .curseur { display: flex; align-items: center; gap: 12px; }
  .valeur {
    min-width: 5ch;
    text-align: right;
    font-size: 13px;
    letter-spacing: 0.04em;
  }

  /* Curseur : piste encre de 4 px, poignée carrée (charte §11). */
  input[type='range'] {
    flex: 1;
    /* On reprend le dessin à zéro : les curseurs natifs sont arrondis. */
    appearance: none;
    -webkit-appearance: none;
    width: auto;
    min-height: var(--cible-tactile);
    padding: 0;
    border: none;
    background: transparent;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    background: var(--encre);
    border-radius: 0;
  }
  input[type='range']::-moz-range-track {
    height: 4px;
    background: var(--encre);
    border-radius: 0;
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -8px;
    background: var(--papier);
    border: var(--bordure) solid var(--encre);
    border-radius: 0;
  }
  input[type='range']::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--papier);
    border: var(--bordure) solid var(--encre);
    border-radius: 0;
  }

  /* Deux réglages courts sur une même ligne, qui se replient si besoin. */
  .paire {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 16px 24px;
    align-items: start;
  }
  @media (max-width: 560px) {
    .paire { grid-template-columns: 1fr; }
  }

  /* Groupes de choix : le retenu passe en encre et porte la barre accent. */
  .choix { display: flex; flex-wrap: wrap; gap: 6px; }
  .choix button {
    min-width: 52px;
    padding: 8px 12px;
    background: var(--papier);
    color: var(--encre);
    font-size: 11px;
  }
  .choix button.actif {
    background: var(--encre);
    color: var(--papier);
    /* Marqueur « vous êtes ici » de la charte §11. */
    box-shadow: inset 4px 0 0 var(--accent), var(--relief) var(--relief) 0 var(--encre);
  }
  .choix button.actif:hover { background: var(--encre); }
</style>
