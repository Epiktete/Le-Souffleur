<script lang="ts">
  // Paramètres IA (CDC §5 et §10) : fournisseur, adresse, modèle, clé,
  // test de connexion, et le rappel de confidentialité.
  //
  // La clé n'est enregistrée sur l'appareil que si la case est cochée.
  import { t, ti, tt } from '../textes';
  import { reglagesIa } from '../etat/reglagesIa.svelte';
  import {
    listerModeles,
    prereglage,
    PREREGLAGES,
    testerConnexion,
    type ResultatTest,
  } from '../services/connecteurIa';
  import { naviguer } from '../services/routeur';

  let resultat = $state<ResultatTest | null>(null);
  let testEnCours = $state(false);
  let enregistre = $state(false);
  let oubliee = $state(false);

  let modeles = $state<string[]>([]);
  let chargementModeles = $state(false);
  let modelesIndisponibles = $state(false);

  const p = $derived(prereglage(reglagesIa.fournisseurId));
  const guideOuvert = $state({ valeur: false });

  async function tester() {
    testEnCours = true;
    resultat = null;
    try {
      resultat = await testerConnexion(reglagesIa.acces);
    } finally {
      testEnCours = false;
    }
  }

  async function chargerModeles() {
    chargementModeles = true;
    modelesIndisponibles = false;
    try {
      modeles = await listerModeles(reglagesIa.acces);
      modelesIndisponibles = modeles.length === 0;
    } finally {
      chargementModeles = false;
    }
  }

  /**
   * L'effacement sur disque est asynchrone : on attend qu'il soit effectif
   * avant de l'annoncer. Une clé qu'on croit oubliée et qui reste enregistrée
   * serait un vrai défaut de confidentialité (CDC §12).
   */
  async function oublier() {
    await reglagesIa.oublierCle();
    oubliee = true;
    setTimeout(() => (oubliee = false), 4000);
  }

  async function enregistrer() {
    if (await reglagesIa.enregistrer()) {
      enregistre = true;
      setTimeout(() => (enregistre = false), 2500);
    }
  }

  /** Rend un des trois points du résultat (CDC §5). */
  function ouiNon(valeur: boolean) {
    return valeur ? tt.oui : tt.non;
  }
</script>

<main>
  <div class="entete">
    <h2>{ti.titre}</h2>
    <a class="bouton secondaire-bouton" href="#/studio">{t.navigation.retourAccueil}</a>
  </div>

  <!-- Fournisseur -->
  <section class="bloc boite">
    <span class="eyebrow">{ti.fournisseur}</span>
    <div class="choix" role="group" aria-label={ti.fournisseur}>
      {#each PREREGLAGES as pr (pr.id)}
        <button
          type="button"
          class:actif={reglagesIa.fournisseurId === pr.id}
          aria-pressed={reglagesIa.fournisseurId === pr.id}
          onclick={() => reglagesIa.choisirFournisseur(pr.id)}
        >{pr.nom}</button>
      {/each}
    </div>
    {#if p.note}
      <p class="aide">{p.note}</p>
    {/if}
  </section>

  <!-- Guide pas à pas, repliable (CDC §10) -->
  <section class="bloc boite">
    <button
      type="button"
      class="secondaire-bouton plein"
      aria-expanded={guideOuvert.valeur}
      onclick={() => (guideOuvert.valeur = !guideOuvert.valeur)}
    >{ti.guide}</button>

    {#if guideOuvert.valeur}
      <ol>
        {#each ti.guideEtapes as etape (etape)}
          <li>{etape}</li>
        {/each}
      </ol>
      {#if p.urlCle}
        <!-- rel=noreferrer : on ne renseigne pas le fournisseur sur la provenance -->
        <a
          class="bouton secondaire-bouton"
          href={p.urlCle}
          target="_blank"
          rel="noopener noreferrer"
        >{ti.ouvrirPageCle}</a>
      {/if}
    {/if}
  </section>

  <!-- Adresse et modèle -->
  <section class="bloc boite">
    <div class="champ">
      <label for="ia-url" class="mono">{ti.adresse}</label>
      <input
        id="ia-url"
        type="url"
        value={reglagesIa.baseUrl}
        aria-describedby="ia-url-aide"
        oninput={(e) => reglagesIa.definirBaseUrl(e.currentTarget.value)}
      />
      <p id="ia-url-aide" class="aide">{ti.adresseAide}</p>
    </div>

    <div class="champ">
      <label for="ia-modele" class="mono">{ti.modele}</label>
      <input
        id="ia-modele"
        list="ia-modeles"
        value={reglagesIa.modele}
        aria-describedby="ia-modele-aide"
        oninput={(e) => reglagesIa.definirModele(e.currentTarget.value)}
      />
      <!-- La liste déroulante se remplit si le fournisseur la donne (CDC §5).
           Avec OpenRouter elle compte plusieurs centaines d'entrées, d'où le
           champ de saisie qui filtre plutôt qu'un simple menu. -->
      <datalist id="ia-modeles">
        {#each modeles as m (m)}<option value={m}></option>{/each}
      </datalist>
      <p id="ia-modele-aide" class="aide">{ti.modeleAide}</p>
      <button
        type="button"
        class="secondaire-bouton"
        disabled={chargementModeles}
        onclick={chargerModeles}
      >{ti.chargerModeles}</button>
      {#if modeles.length > 0}
        <p class="aide" aria-live="polite">{modeles.length} modèles proposés.</p>
      {/if}
      {#if modelesIndisponibles}
        <p class="aide" aria-live="polite">{ti.modelesIndisponibles}</p>
      {/if}
    </div>
  </section>

  <!-- Clé API -->
  <section class="bloc boite">
    <div class="champ">
      <label for="ia-cle" class="mono">{ti.cle}</label>
      <input
        id="ia-cle"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder={ti.clePlaceholder}
        value={reglagesIa.cle}
        oninput={(e) => reglagesIa.definirCle(e.currentTarget.value)}
      />

      <label class="case">
        <input
          type="checkbox"
          checked={reglagesIa.memoriser}
          onchange={(e) => reglagesIa.definirMemoriser(e.currentTarget.checked)}
        />
        <span>{ti.memoriser}</span>
      </label>
      <!-- Avertissement imposé par le CDC §5 -->
      <p class="aide">{ti.memoriserAvertissement}</p>
      <p class="aide">{reglagesIa.memoriser ? ti.cleMemorisee : ti.cleEnMemoire}</p>

      <p class="aide" aria-live="polite">{oubliee ? ti.oubliee : ''}</p>

      {#if reglagesIa.cle}
        <button type="button" class="secondaire-bouton" onclick={oublier}>
          {ti.oublier}
        </button>
      {/if}
    </div>
  </section>

  <!-- Test de connexion : les trois points du CDC §5 -->
  <section class="bloc boite">
    <button
      type="button"
      disabled={testEnCours || !reglagesIa.cle.trim() || !reglagesIa.baseUrl.trim()}
      onclick={tester}
    >{testEnCours ? tt.enCours : tt.bouton}</button>

    <div aria-live="polite">
      {#if resultat}
        <ul class="points">
          <li><span>{tt.cleAcceptee}</span><span class="mono">{ouiNon(resultat.cleAcceptee)}</span></li>
          <li><span>{tt.appelPossible}</span><span class="mono">{ouiNon(resultat.appelPossible)}</span></li>
          <li><span>{tt.jsonValide}</span><span class="mono">{ouiNon(resultat.jsonValide)}</span></li>
        </ul>
        <p class="message" class:echec={!resultat.jsonValide}>{resultat.message}</p>
        {#if resultat.latenceMs !== undefined}
          <p class="aide">{tt.latence(resultat.latenceMs)}</p>
        {/if}
        {#if resultat.jetons?.total !== undefined}
          <p class="aide">{tt.jetons(resultat.jetons.total)}</p>
        {/if}
      {/if}
    </div>
  </section>

  <!-- Rappel de confidentialité (CDC §10) -->
  <section class="bloc boite">
    <p class="aide">{ti.confidentialite}</p>
  </section>

  <div class="pied">
    <button type="button" onclick={enregistrer}>{ti.enregistrer}</button>
    <span class="aide" aria-live="polite">{enregistre ? 'Enregistré.' : ''}</span>
  </div>
</main>

<style>
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px 16px 48px;
    overflow-y: auto;
  }

  .entete { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .entete h2 { flex: 1; }

  .bloc { padding: 14px; margin-bottom: 16px; }
  .bloc > .eyebrow { margin-bottom: 10px; }

  .champ { margin-bottom: 16px; }
  .champ:last-child { margin-bottom: 0; }
  .champ > label { display: block; margin-bottom: 4px; }
  .champ > button { margin-top: 8px; }

  .aide { font-size: 13px; color: var(--encre2); margin: 6px 0 0; }

  .choix { display: flex; flex-wrap: wrap; gap: 6px; }
  .choix button {
    padding: 8px 12px;
    background: var(--papier);
    color: var(--encre);
    font-size: 11px;
  }
  .choix button:hover { box-shadow: none; }
  .choix button.actif { background: var(--encre); color: var(--papier); }

  .plein { width: 100%; }

  ol { margin: 12px 0; padding-left: 22px; }
  li { color: var(--encre2); margin-bottom: 4px; }

  /* Case à cocher : carrée, bordure encre, comme le reste (charte §11). */
  .case {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 14px;
    cursor: pointer;
  }
  .case input {
    width: 20px;
    min-width: 20px;
    height: 20px;
    min-height: 20px;
    appearance: none;
    -webkit-appearance: none;
    border: var(--bordure) solid var(--encre);
    background: var(--papier);
    padding: 0;
  }
  .case input:checked { background: var(--encre); }

  .points { list-style: none; margin: 14px 0 0; padding: 0; }
  .points li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--gris);
    font-size: 14px;
    color: var(--encre);
  }

  .message { margin-top: 12px; font-size: 15px; }
  /* Le rouge ne sert qu'à signaler une erreur (charte §11). */
  .message.echec { border-left: 4px solid var(--accent); padding-left: 10px; }

  .pied { display: flex; align-items: center; gap: 12px; }
</style>
