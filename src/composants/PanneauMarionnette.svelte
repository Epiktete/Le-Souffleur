<script lang="ts">
  // Formulaire de création et de modification, dans un panneau latéral (CDC §7).
  // Nom obligatoire, description avec exemple, espèce en texte libre, genre.
  // Les traits ne se saisissent plus (décision du 2026-09-28) : les anciennes
  // marionnettes gardent les leurs, la description porte le caractère.
  import { BORNES } from '../config';
  import { tb } from '../textes';
  import { validerSaisie, type ErreursSaisie } from '../services/marionnettes';
  import type { Marionnette } from '../types';

  interface Props {
    /** Marionnette à modifier, ou marionnette vierge pour une création. */
    marionnette: Marionnette;
    /** Vrai s'il s'agit d'une création : change seulement le titre. */
    creation: boolean;
    surEnregistrer: (m: Marionnette) => Promise<boolean>;
    surAnnuler: () => void;
  }
  let { marionnette, creation, surEnregistrer, surAnnuler }: Props = $props();

  // Copie de travail : annuler ne doit rien changer à la marionnette d'origine.
  // La valeur n'est lue qu'au montage, volontairement. C'est la bibliothèque qui
  // recrée ce panneau (clé sur l'identifiant) quand on passe à une autre
  // marionnette, donc il n'y a pas de valeur obsolète à craindre.
  // svelte-ignore state_referenced_locally
  let nom = $state(marionnette.nom);
  // svelte-ignore state_referenced_locally
  let description = $state(marionnette.description);
  // svelte-ignore state_referenced_locally
  let espece = $state(marionnette.espece ?? '');
  // svelte-ignore state_referenced_locally
  let genre = $state<Marionnette['genre']>(marionnette.genre);

  let erreurs = $state<ErreursSaisie>({});
  /** Un échec d'enregistrement (stockage plein, navigation privée) se dit ici. */
  let erreurEnregistrement = $state<string | null>(null);
  let enregistrement = $state(false);
  /** Les erreurs n'apparaissent qu'après une première tentative d'envoi. */
  let tentative = $state(false);

  let champNom = $state<HTMLInputElement>();

  const saisie = $derived({ nom, description, espece });

  // Le focus part sur le nom : c'est le seul champ obligatoire.
  $effect(() => { champNom?.focus(); });

  // Une fois l'utilisateur averti, les messages se mettent à jour en direct.
  $effect(() => { if (tentative) erreurs = validerSaisie(saisie); });

  async function envoyer(evenement: SubmitEvent) {
    evenement.preventDefault();
    tentative = true;
    erreurs = validerSaisie(saisie);
    if (Object.keys(erreurs).length > 0) {
      champNom?.focus();
      return;
    }

    enregistrement = true;
    const ok = await surEnregistrer({
      ...marionnette,
      nom: nom.trim(),
      description: description.trim(),
      espece: espece.trim() || undefined,
      genre,
    });
    enregistrement = false;
    if (!ok) erreurEnregistrement = tb.erreurs.enregistrementImpossible;
  }

  // Échap ferme le panneau, comme partout dans l'application.
  function surTouche(evenement: KeyboardEvent) {
    if (evenement.key === 'Escape') surAnnuler();
  }
</script>

<svelte:window onkeydown={surTouche} />

<aside aria-label={creation ? tb.titreCreation : tb.titreModification}>
  <!-- novalidate : c'est notre validation qui parle, en français et sans jargon
       (CDC §5 et §7). L'attribut required reste pour les lecteurs d'écran. -->
  <form onsubmit={envoyer} novalidate>
    <header>
      <h2>{creation ? tb.titreCreation : tb.titreModification}</h2>
      <button type="button" class="secondaire-bouton" onclick={surAnnuler}>{tb.fermer}</button>
    </header>

    <div class="corps">
      <!-- Nom : le seul champ obligatoire -->
      <div class="champ">
        <label for="m-nom" class="mono">{tb.champNom}</label>
        <input
          id="m-nom"
          bind:this={champNom}
          bind:value={nom}
          maxlength={BORNES.nomMarionnette.max}
          required
          aria-describedby="m-nom-aide"
          aria-invalid={erreurs.nom ? 'true' : undefined}
        />
        <p id="m-nom-aide" class="aide">{tb.champNomAide}</p>
        {#if erreurs.nom}<p class="erreur" role="alert">{erreurs.nom}</p>{/if}
      </div>

      <!-- Description -->
      <div class="champ">
        <label for="m-description" class="mono">{tb.champDescription}</label>
        <textarea
          id="m-description"
          bind:value={description}
          maxlength={BORNES.descriptionMarionnette.max}
          aria-describedby="m-description-aide"
        ></textarea>
        <p id="m-description-aide" class="aide">{tb.champDescriptionAide}</p>
        <p class="compteur mono">
          {tb.compteur(description.length, BORNES.descriptionMarionnette.max)}
        </p>
        {#if erreurs.description}<p class="erreur" role="alert">{erreurs.description}</p>{/if}
      </div>

      <!-- Espèce en texte libre : le mot que les histoires emploieront
           (CDC §7, décision du 2026-09-28). -->
      <div class="champ">
        <label for="m-espece" class="mono">{tb.champEspece}</label>
        <input
          id="m-espece"
          bind:value={espece}
          maxlength={BORNES.especeMarionnette.max}
          aria-describedby="m-espece-aide"
          aria-invalid={erreurs.espece ? 'true' : undefined}
        />
        <p id="m-espece-aide" class="aide">{tb.champEspeceAide}</p>
        {#if erreurs.espece}<p class="erreur" role="alert">{erreurs.espece}</p>{/if}
      </div>

      <!-- Genre grammatical : « il » ou « elle » dans les histoires (CDC §7,
           chantier « la banque »). Facultatif, et effaçable d'un reclic. -->
      <div class="champ">
        <span class="mono">{tb.champGenre}</span>
        <p class="aide">{tb.champGenreAide}</p>
        <div class="puces">
          {#each ([['masculin', tb.genreIl], ['feminin', tb.genreElle]] as const) as [valeur, libelle] (valeur)}
            <button
              type="button"
              class="puce"
              class:choisi={genre === valeur}
              aria-pressed={genre === valeur}
              onclick={() => (genre = genre === valeur ? undefined : valeur)}
            >{libelle}</button>
          {/each}
        </div>
      </div>

      {#if erreurEnregistrement}
        <p class="erreur" role="alert">{erreurEnregistrement}</p>
      {/if}
    </div>

    <footer>
      <button type="button" class="secondaire-bouton" onclick={surAnnuler}>{tb.annuler}</button>
      <button type="submit" disabled={enregistrement}>{tb.enregistrer}</button>
    </footer>
  </form>
</aside>

<style>
  aside {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 100vw);
    background: var(--papier);
    border-left: var(--bordure) solid var(--encre);
    z-index: 20;
  }
  form { display: flex; flex-direction: column; height: 100%; }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-bottom: var(--bordure) solid var(--encre);
  }
  header h2 { flex: 1; font-size: 17px; }

  .corps { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }

  .champ { margin-bottom: 20px; }
  .champ > label, .champ > span.mono { display: block; margin-bottom: 4px; }

  .aide { font-size: 13px; color: var(--encre2); margin: 4px 0 6px; }
  .compteur { color: var(--encre2); font-size: 11px; text-align: right; margin: 4px 0 0; }

  /* Le rouge ne sert qu'à signaler, jamais à décorer (CDC §11). */
  .erreur {
    margin: 6px 0 0;
    padding-left: 8px;
    border-left: 4px solid var(--accent);
    font-size: 14px;
    color: var(--encre);
  }

  .puces { display: flex; flex-wrap: wrap; gap: 6px; }
  .puce {
    min-height: 32px;
    padding: 4px 8px;
    background: var(--papier);
    color: var(--encre);
    font-size: 11px;
    letter-spacing: 0.1em;
    box-shadow: 2px 2px 0 var(--encre);
  }
  .puce:hover:not(:disabled) { background: var(--papier); text-decoration: underline; }
  /* Trait retenu : encre, avec la barre accent qui marque le choix (§11). */
  .puce.choisi {
    background: var(--encre);
    color: var(--papier);
    box-shadow: inset 3px 0 0 var(--accent), 2px 2px 0 var(--encre);
  }
  .puce.choisi:hover { background: var(--encre); }

  footer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: var(--bordure) solid var(--encre);
  }
  footer button { flex: 1; }
</style>
