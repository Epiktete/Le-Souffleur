<script lang="ts">
  // Formulaire de création et de modification, dans un panneau latéral (CDC §7).
  // Nom obligatoire, description avec exemple, traits en puces cliquables,
  // voix et tic de langage, photo facultative redimensionnée à 512 px.
  import Vignette from './Vignette.svelte';
  import { BORNES } from '../config';
  import { tb, TRAITS_PROPOSES } from '../textes';
  import { preparerPhoto } from '../services/photo';
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
  let traits = $state([...marionnette.traits]);
  // svelte-ignore state_referenced_locally
  let voix = $state(marionnette.voix ?? '');
  // svelte-ignore state_referenced_locally
  let photo = $state<Blob | undefined>(marionnette.photo);

  let traitLibre = $state('');
  let erreurs = $state<ErreursSaisie>({});
  let erreurPhoto = $state<string | null>(null);
  let photoEnCours = $state(false);
  let enregistrement = $state(false);
  /** Les erreurs n'apparaissent qu'après une première tentative d'envoi. */
  let tentative = $state(false);

  let champNom = $state<HTMLInputElement>();
  let entreeFichier = $state<HTMLInputElement>();
  let entreeAppareil = $state<HTMLInputElement>();

  const saisie = $derived({ nom, description, traits, voix });
  const traitsPleins = $derived(traits.length >= BORNES.traitsMarionnette.max);
  /** Traits saisis librement : ils ne figurent pas dans la liste proposée. */
  const traitsLibres = $derived(
    traits.filter((t) => !(TRAITS_PROPOSES as readonly string[]).includes(t)),
  );

  // Le focus part sur le nom : c'est le seul champ obligatoire.
  $effect(() => { champNom?.focus(); });

  // Une fois l'utilisateur averti, les messages se mettent à jour en direct.
  $effect(() => { if (tentative) erreurs = validerSaisie(saisie); });

  function basculerTrait(trait: string) {
    if (traits.includes(trait)) traits = traits.filter((t) => t !== trait);
    else if (!traitsPleins) traits = [...traits, trait];
  }

  function ajouterTraitLibre() {
    const propre = traitLibre.trim().toLowerCase();
    if (!propre || traitsPleins || traits.includes(propre)) return;
    traits = [...traits, propre];
    traitLibre = '';
  }

  async function surFichier(evenement: Event) {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = ''; // permet de reprendre le même fichier ensuite
    if (!fichier) return;

    erreurPhoto = null;
    photoEnCours = true;
    try {
      photo = await preparerPhoto(fichier);
    } catch {
      erreurPhoto = tb.erreurs.photoIllisible;
    } finally {
      photoEnCours = false;
    }
  }

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
      traits,
      voix: voix.trim() || undefined,
      photo,
    });
    enregistrement = false;
    if (!ok) erreurPhoto = tb.erreurs.enregistrementImpossible;
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

      <!-- Traits : puces cliquables, 6 au maximum -->
      <div class="champ">
        <span class="mono">{tb.champTraits}</span>
        <p class="aide">{tb.champTraitsAide}</p>

        <div class="puces">
          {#each TRAITS_PROPOSES as trait (trait)}
            {@const choisi = traits.includes(trait)}
            <button
              type="button"
              class="puce"
              class:choisi
              aria-pressed={choisi}
              disabled={!choisi && traitsPleins}
              onclick={() => basculerTrait(trait)}
            >{trait}</button>
          {/each}

          <!-- Traits ajoutés librement, affichés à la suite des puces. -->
          {#each traitsLibres as trait (trait)}
            <button
              type="button"
              class="puce choisi"
              aria-pressed="true"
              onclick={() => basculerTrait(trait)}
            >{trait}</button>
          {/each}
        </div>

        <div class="ajout">
          <label class="invisible" for="m-trait-libre">{tb.champTraitLibre}</label>
          <input
            id="m-trait-libre"
            bind:value={traitLibre}
            placeholder={tb.champTraitLibre}
            maxlength="24"
            disabled={traitsPleins}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterTraitLibre(); } }}
          />
          <button
            type="button"
            class="secondaire-bouton"
            disabled={traitsPleins}
            onclick={ajouterTraitLibre}
            aria-label={tb.champTraitLibre}
          >+</button>
        </div>
        <p class="compteur mono">{tb.compteur(traits.length, BORNES.traitsMarionnette.max)}</p>
        {#if erreurs.traits}<p class="erreur" role="alert">{erreurs.traits}</p>{/if}
      </div>

      <!-- Voix et tic de langage : aide-mémoire précieux pour jouer (CDC §8) -->
      <div class="champ">
        <label for="m-voix" class="mono">{tb.champVoix}</label>
        <input id="m-voix" bind:value={voix} maxlength="200" aria-describedby="m-voix-aide" />
        <p id="m-voix-aide" class="aide">{tb.champVoixAide}</p>
        {#if erreurs.voix}<p class="erreur" role="alert">{erreurs.voix}</p>{/if}
      </div>

      <!-- Photo facultative -->
      <div class="champ">
        <span class="mono">{tb.champPhoto}</span>
        <p class="aide">{tb.champPhotoAide}</p>

        <div class="photo">
          <Vignette {nom} {photo} taille={72} />
          <div class="photo-actions">
            <button type="button" class="secondaire-bouton" onclick={() => entreeFichier?.click()}>
              {tb.choisirPhoto}
            </button>
            <!-- « capture » ouvre l'appareil photo sur tablette et téléphone. -->
            <button type="button" class="secondaire-bouton" onclick={() => entreeAppareil?.click()}>
              {tb.prendrePhoto}
            </button>
            {#if photo}
              <button type="button" class="secondaire-bouton" onclick={() => (photo = undefined)}>
                {tb.retirerPhoto}
              </button>
            {/if}
          </div>
        </div>

        <input bind:this={entreeFichier} type="file" accept="image/*" hidden onchange={surFichier} />
        <input
          bind:this={entreeAppareil}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onchange={surFichier}
        />

        <p class="etat mono" aria-live="polite">{photoEnCours ? tb.photoEnCours : ''}</p>
        {#if erreurPhoto}<p class="erreur" role="alert">{erreurPhoto}</p>{/if}
      </div>
    </div>

    <footer>
      <button type="button" class="secondaire-bouton" onclick={surAnnuler}>{tb.annuler}</button>
      <button type="submit" disabled={enregistrement || photoEnCours}>{tb.enregistrer}</button>
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
  .etat { color: var(--encre2); font-size: 11px; margin: 6px 0 0; min-height: 1em; }

  /* Le rouge ne sert qu'à signaler, jamais à décorer (CDC §11). */
  .erreur {
    margin: 6px 0 0;
    padding-left: 8px;
    border-left: 4px solid var(--accent);
    font-size: 14px;
    color: var(--encre);
  }

  /* Étiquette réservée aux lecteurs d'écran. */
  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
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

  .ajout { display: flex; gap: 6px; margin-top: 8px; }
  .ajout input { flex: 1; }
  .ajout button { flex: 0 0 var(--cible-tactile); }

  .photo { display: flex; gap: 12px; align-items: flex-start; }
  .photo-actions { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .photo-actions button { font-size: 10px; }

  footer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: var(--bordure) solid var(--encre);
  }
  footer button { flex: 1; }
</style>
