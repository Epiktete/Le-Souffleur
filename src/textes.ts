// Tous les textes de l'interface, regroupés ici (CDC §1 et §13).
// Français uniquement en V1 ; cette centralisation permettra une traduction
// future sans toucher aux composants.

import { NOM_OUTIL } from './config';

export const t = {
  /** En-tête (CDC §7). */
  entete: {
    nom: NOM_OUTIL,
    parametresIa: 'Paramètres IA',
    sauvegarde: 'Sauvegarde',
    aide: 'Aide',
    ouvrirBibliotheque: 'Ouvrir la marionnethèque',
    ouvrirSpectacles: 'Ouvrir les spectacles',
    fermer: 'Fermer',
  },

  /** Indicateur d'état de la clé API (CDC §7). */
  etatCle: {
    absente: 'Clé absente',
    ok: 'Clé OK',
    demo: 'Mode démo',
  },

  /** Libellés des trois colonnes (CDC §7 et §11 : eyebrow mono sur pastille). */
  colonnes: {
    bibliotheque: 'Marionnethèque',
    studio: 'Studio',
    spectacles: 'Spectacles',
  },

  /** Écrans vides du socle, remplacés aux étapes suivantes. */
  vide: {
    bibliotheque: 'Aucune marionnette pour le moment.',
    studio: 'Choisissez des marionnettes pour préparer un spectacle.',
    spectacles: 'Aucun spectacle pour le moment.',
  },

  /** Navigation (CDC §7). */
  navigation: {
    retour: 'Retour',
    accueil: 'Accueil',
    jouer: 'Jouer',
    introuvable: 'Cette page n’existe pas.',
    retourAccueil: 'Revenir à l’accueil',
  },

  /**
   * Messages d'erreur du connecteur IA, repris mot pour mot du CDC §5.
   * Validés lors de l'étape 0.
   */
  erreursIa: {
    cleRefusee: 'La clé est refusée. Vérifiez qu’elle est copiée en entier.',
    creditEpuise: 'Votre compte chez le fournisseur n’a plus de crédit.',
    tropDeDemandes: 'Trop de demandes d’un coup. Réessayez dans une minute.',
    navigateurBloque:
      'Ce fournisseur bloque les appels depuis un navigateur, ou vous êtes hors ligne. Essayez OpenRouter.',
    delaiDepasse:
      'Le modèle met trop de temps. Essayez un modèle plus rapide ou un spectacle plus court.',
    jsonInvalide: 'Le modèle n’a pas respecté le format. Essayez un autre modèle.',
    /** Cas non prévus par le tableau du §5. */
    erreurFournisseur: (statut: number) =>
      `Le fournisseur a refusé la demande (erreur ${statut}). Vérifiez le nom du modèle.`,
    reponseIncomprehensible:
      'Le fournisseur a répondu quelque chose d’inattendu. Vérifiez l’adresse du service.',
    /**
     * Cas fréquent avec les modèles à raisonnement, dont les jetons de
     * réflexion sont décomptés du budget de la réponse.
     */
    reponseTronquee:
      'Le modèle s’est arrêté avant d’avoir fini. Essayez un spectacle plus court, '
      + 'ou un modèle sans mode de réflexion.',
    annule: 'Demande annulée.',
    /**
     * Le répertoire n'a plus de conte à proposer pour ces marionnettes : tous
     * ont déjà été montrés, ou aucun ne convient à ce nombre de personnages.
     */
    repertoireEpuise:
      'La contothèque n’a plus de conte à proposer pour ces marionnettes. Essayez d’en ajouter ou d’en retirer une.',
    /** Le conte d'un synopsis n'existe plus dans le répertoire (mise à jour). */
    conteIntrouvable:
      'Le conte choisi est introuvable dans la contothèque. Demandez de nouvelles propositions.',
  },

  /** Stockage local (CDC §12). */
  stockage: {
    erreurOuverture:
      'Impossible d’ouvrir le stockage de ce navigateur. Vos données ne pourront pas être enregistrées.',
    navigationPriveeProbable:
      'Si vous naviguez en privé, le navigateur peut refuser d’enregistrer vos données.',
  },
} as const;

/**
 * Traits proposés en puces cliquables (CDC §7).
 * L'utilisateur peut en ajouter librement, dans la limite de 6 par marionnette.
 */
export const TRAITS_PROPOSES = [
  'gentil', 'méchant', 'coquin', 'rusé', 'peureux', 'courageux', 'gourmand',
  'grognon', 'rêveur', 'bavard', 'maladroit', 'savant', 'farceur', 'timide',
] as const;

/** Textes de la bibliothèque de marionnettes (CDC §7, colonne de gauche). */
export const tb = {
  nouvelle: '+ Nouvelle marionnette',
  rechercher: 'Rechercher une marionnette',
  rechercherCourt: 'Rechercher',
  aucunResultat: 'Aucune marionnette ne correspond à cette recherche.',

  /** Actions sur une fiche. */
  modifier: 'Modifier',
  dupliquer: 'Dupliquer',
  supprimer: 'Supprimer',
  annuler: 'Annuler',
  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
  deplier: 'Voir la fiche',
  replier: 'Replier la fiche',

  /** Suffixe ajouté au nom d'une copie. */
  suffixeCopie: 'copie',

  /** Confirmation de suppression (CDC §7 : suppression confirmée). */
  confirmerSuppression: (nom: string) =>
    `Supprimer « ${nom} » de la marionnethèque ? Les spectacles déjà générés ne sont pas touchés.`,
  supprimerDefinitivement: 'Supprimer définitivement',

  /** Formulaire, dans un panneau latéral. */
  titreCreation: 'Nouvelle marionnette',
  titreModification: 'Modifier la marionnette',
  champNom: 'Nom',
  champNomAide: 'Obligatoire, 40 caractères au plus.',
  champDescription: 'Description',
  champDescriptionAide:
    'Apparence, espèce, taille. Ex. : « Petit lapin en peluche beige, oreilles tombantes, écharpe rouge. »',
  champTraits: 'Traits de caractère',
  champTraitsAide: 'De 1 à 6 traits. Cliquez pour choisir, ou ajoutez le vôtre.',
  champTraitLibre: 'Ajouter un trait',
  champVoix: 'Voix et tic de langage',
  champVoixAide: 'Ex. : « voix grave, parle lentement, dit toujours sapristi ».',
  champPhoto: 'Photo',
  champPhotoAide:
    'Facultatif. La photo reste sur cet appareil et n’est jamais envoyée à l’IA.',
  choisirPhoto: 'Choisir une photo',
  prendrePhoto: 'Prendre une photo',
  retirerPhoto: 'Retirer la photo',
  photoEnCours: 'Préparation de la photo…',

  /** Messages de validation, en français et sans jargon. */
  erreurs: {
    nomVide: 'Donnez un nom à la marionnette.',
    nomTropLong: 'Le nom ne doit pas dépasser 40 caractères.',
    descriptionTropLongue: 'La description ne doit pas dépasser 500 caractères.',
    traitsVides: 'Choisissez au moins un trait de caractère.',
    traitsTropNombreux: 'Six traits au maximum.',
    traitDejaPresent: 'Ce trait est déjà choisi.',
    voixTropLongue: 'La voix ne doit pas dépasser 200 caractères.',
    photoIllisible: 'Ce fichier n’est pas une image que le navigateur sait lire.',
    enregistrementImpossible:
      'Impossible d’enregistrer. Le navigateur refuse peut-être de stocker des données.',
  },

  /** Compteur de caractères. */
  compteur: (utilises: number, max: number) => `${utilises} / ${max}`,
  /** Nombre de marionnettes, pour le lecteur d'écran. */
  nombre: (n: number) => (n === 1 ? '1 marionnette' : `${n} marionnettes`),
} as const;

/** Textes du studio : la scène et les réglages (CDC §7, colonne centrale). */
export const ts = {
  scene: {
    titre: 'Personnages',
    vide: 'Ajoutez des marionnettes depuis la marionnethèque, avec la flèche sur le côté de chaque boîte.',
    versLaScene: (nom: string) => `Ajouter ${nom} aux personnages`,
    versLaBibliotheque: (nom: string) => `Retirer ${nom} des personnages`,
    pleine: (max: number) => `C’est complet : ${max} marionnettes au maximum.`,
    dejaEnScene: 'Choisie',
    compte: (n: number, max: number) => `${n} / ${max} choisies`,
  },

  reglages: {
    duree: 'Durée',
    dureeValeur: (min: number) => `${min} min`,
    age: 'Âge de l’auditoire',
    ageValeur: (ans: number) => `${ans} ans`,
    marionnettistes: 'Marionnettistes',
    marionnettisteUn: '1',
    marionnettisteDeux: '2',
    interaction: 'Interaction avec le public',
    interactionAucune: 'Aucune',
    interactionQuelques: 'Quelques',
    interactionBeaucoup: 'Beaucoup',
  },

  /**
   * Message d'aide affiché quand il y a plus de marionnettes que de mains
   * disponibles (CDC §7). Ce n'est pas une erreur : le script gérera les
   * entrées et les sorties.
   */
  aideMains: (marionnettes: number, marionnettistes: number, mains: number) =>
    `${marionnettes} marionnettes pour ${marionnettistes} marionnettiste${marionnettistes > 1 ? 's' : ''} : `
    + `jamais plus de ${mains} en scène en même temps, le script gérera les entrées et sorties.`,

  ebauche: {
    titre: 'Ébauche de scénario',
    /** L'ébauche sert à choisir le conte : ceux qui en parlent passent devant. */
    aide: 'Facultatif. Ce que vous aimeriez voir : un thème, un lieu, un animal… Ex. : « une histoire de ruse au bord de la rivière ». Les contes qui s’en approchent passent devant.',
  },

  generer: {
    bouton: 'Générer le script',
    sansMarionnette: 'Ajoutez au moins une marionnette aux personnages pour générer un script.',
    sansCle: 'Configurer ma clé IA',
  },
} as const;

/** Textes des paramètres IA et du test de connexion (CDC §5 et §10). */
export const ti = {
  titre: 'Paramètres IA',
  fournisseur: 'Fournisseur',
  adresse: 'Adresse du service',
  adresseAide: 'Ne changez ceci que pour un service non listé, comme Ollama en local.',
  modele: 'Modèle',
  modeleAide: 'Vous pouvez saisir un autre nom de modèle si celui-ci ne vous convient pas.',
  chargerModeles: 'Voir les modèles disponibles',
  modelesIndisponibles: 'Ce fournisseur ne donne pas la liste de ses modèles. Saisissez le nom à la main.',
  cle: 'Clé API',
  clePlaceholder: 'collez votre clé ici',
  memoriser: 'Mémoriser la clé sur cet appareil',
  /** Avertissement imposé par le CDC §5. */
  memoriserAvertissement:
    'Toute personne utilisant ce navigateur pourra lire une clé mémorisée.',
  oublier: 'Oublier la clé',
  oubliee: 'Clé effacée de cet appareil.',
  cleEnMemoire: 'La clé est gardée le temps de cette visite seulement.',
  cleMemorisee: 'La clé est enregistrée sur cet appareil.',

  guide: 'Comment obtenir une clé ?',
  guideEtapes: [
    'Créez un compte chez le fournisseur.',
    'Ajoutez un peu de crédit : quelques euros suffisent pour de nombreux spectacles.',
    'Créez une clé API.',
    'Copiez-la en entier et collez-la dans le champ ci-dessous.',
  ],
  ouvrirPageCle: 'Ouvrir la page des clés',

  /** Rappel de confidentialité (CDC §10). */
  confidentialite:
    'Votre clé et vos données restent dans ce navigateur. Seuls les fiches des marionnettes '
    + 'et votre ébauche sont envoyés au fournisseur que vous avez choisi, au moment d’une génération. '
    + 'Les photos ne sont jamais envoyées.',

  enregistrer: 'Enregistrer',
  fermer: 'Fermer',
} as const;

/** Résultat du bouton « Tester la connexion » (CDC §5). */
export const tt = {
  bouton: 'Tester la connexion',
  enCours: 'Test en cours…',
  annuler: 'Annuler',
  cleAcceptee: 'Clé acceptée',
  appelPossible: 'Appel possible depuis ce navigateur',
  jsonValide: 'Format de réponse correct',
  succes: 'Tout est bon : vous pouvez générer un spectacle.',
  latence: (ms: number) => `Réponse en ${ms} ms`,
  jetons: (total: number) => `${total} jetons consommés`,
  oui: 'oui',
  non: 'non',
} as const;

/** Textes de la génération du script (CDC §6 et §7). */
export const tg = {
  /** Libellés des étapes, affichés dans la barre de progression. */
  etapes: {
    propositions: 'Consulte la contothèque',
    /** Passe 1 : les personnages deviennent les marionnettes. */
    transposition: 'Adaptation du conte',
    /** Passe 2 : tableaux et actes, puis chaque acte mis en scène. */
    construction: 'Découpage en actes',
    ecriture: 'Mise en scène des actes',
    controles: 'Vérifications',
    relecture: 'Relecture',
    corrections: 'Corrections',
    assemblage: 'Assemblage',
  },
  acteSur: (n: number, total: number) => `Acte ${n} sur ${total}`,
  /** Une étape qui recommence : le parent doit savoir que ce n'est pas figé. */
  reprise: (n: number) => `essai ${n}`,
  annuler: 'Annuler',
  /** Nom de la zone de progression, pour les lecteurs d'écran. */
  enCours: 'Génération en cours',

  /** Écran de choix des trois histoires (CDC §6, étape 4). */
  choix: {
    titre: 'Choisissez une histoire',
    sousTitre: 'Trois contes choisis pour vos marionnettes. Vous pourrez encore tout modifier ensuite.',
    /** La référence au conte d'origine : le parent doit savoir ce qu'on adapte. */
    dApres: 'D’après',
    histoire: 'L’histoire',
    distribution: 'Qui joue qui',
    changements: 'Ce qui change par rapport au conte',
    choisir: 'Choisir cette histoire',
    ajuster: 'Ajuster (facultatif)',
    ajusterAide: 'Ex. : « plus drôle », « Loulou doit gagner ».',
    autres: 'Proposer 3 autres histoires',
    autresRestantes: (n: number) => `${n} relance${n > 1 ? 's' : ''} possible${n > 1 ? 's' : ''}`,
    plusDeRelances: 'Vous avez vu toutes les propositions possibles.',
    abandonner: 'Abandonner',
  },

  /** Fin de génération. */
  fin: {
    titre: 'Votre spectacle est prêt',
    ouvrir: 'Ouvrir le script',
        jetons: (total: number) => `${total} jetons consommés pour ce spectacle.`,
  },

  /** Erreurs de génération. */
  erreur: {
    titre: 'La génération s’est arrêtée',
    reessayer: 'Réessayer',
    fermer: 'Fermer',
    details: 'Détail technique',
    detailsAide:
      'Copiez ces lignes si vous signalez le problème. Elles ne contiennent pas votre clé.',
  },
} as const;

/** Textes de la colonne des spectacles (CDC §7, colonne de droite). */
export const tsp = {
  ouvrir: 'Ouvrir',
  renommer: 'Renommer',
  supprimer: 'Supprimer',
  confirmerSuppression: (titre: string) => `Supprimer le spectacle « ${titre} » ?`,
  supprimerDefinitivement: 'Supprimer définitivement',
  annuler: 'Annuler',
  statuts: {
    propositions: 'Propositions en cours',
    choix_en_attente: 'Choix en attente',
    ecriture: 'Écriture en cours',
    complet: '',
    erreur: 'Interrompu',
  },
  meta: (duree: string, age: number) => `${duree} · ${age} ans`,
} as const;

/** Textes de l'écran de script (CDC §8). */
export const tsc = {
  retour: 'Retour',
  jouer: 'Jouer',
  introuvable: 'Ce spectacle est introuvable.',

  /** En-tête du script. */
  titreModifiable: 'Titre du spectacle',
  pitch: 'Pitch',
  duree: 'Durée estimée',
  age: 'Âge',
  ageValeur: (ans: number) => `${ans} ans`,
  marionnettistes: 'Marionnettistes',
  distribution: 'Distribution',
  voix: 'Voix',
  sansVoix: 'Voix non précisée',

  /** Bandeau des tableaux (décors). */
  tableaux: 'Tableaux',
  tableauNumero: (n: number, titre: string) => `Tableau ${n} : ${titre}`,
  imprimer: 'Imprimer',

  /** Corps du script. */
  acte: (n: number) => `Acte ${n}`,
  labelAction: 'ACTION',
  labelPublic: 'AU PUBLIC',
  labelNote: 'NOTE',
  attendreReponse: 'attendre la réponse',
  entree: (nom: string, main: string) => `ENTRÉE : ${nom.toUpperCase()} · ${main}`,
  sortie: (nom: string, main: string) => `SORTIE : ${nom.toUpperCase()} · ${main}`,
  mainGauche: 'MAIN GAUCHE',
  mainDroite: 'MAIN DROITE',

  /** Édition d'un élément. */
  modifier: 'Modifier cet élément',
  valider: 'Valider',
  annulerEdition: 'Annuler',
  insererAvant: 'Insérer avant',
  insererApres: 'Insérer après',
  supprimerElement: 'Supprimer',
  monter: 'Déplacer vers le haut',
  descendre: 'Déplacer vers le bas',
  ton: 'Ton',
  typeElement: 'Type',
  quiParle: 'Qui parle',
  attendreReponseCase: 'Attendre la réponse du public',
  main: 'Main',
  typesElements: {
    replique: 'Réplique',
    didascalie: 'Action',
    adresse_public: 'Adresse au public',
    note_marionnettiste: 'Note au marionnettiste',
    entree: 'Entrée',
    sortie: 'Sortie',
  },

  /** Annuler et rétablir (CDC §8). */
  annuler: 'Annuler',
  retablir: 'Rétablir',
  annulerRaccourci: 'Annuler (Ctrl+Z)',
  retablirRaccourci: 'Rétablir (Ctrl+Maj+Z)',

  /** Régénération d'un acte. */
  regenerer: 'Régénérer cet acte',
  regenererConsigne: 'Consigne (facultatif)',
  regenererConsigneAide: 'Ex. : « plus drôle », « Loulou doit gagner ».',
  regenererLancer: 'Lancer',
  regenererEnCours: 'Régénération en cours…',
  garderNouvelle: 'Garder la nouvelle',
  revenirAncienne: 'Revenir à l’ancienne',
  comparaison: 'Nouvelle version — comparez avant de choisir.',

  /** Avertissements non bloquants. */

  enregistre: 'Enregistré',
} as const;

/** Textes du mode lecture, le spectacle joué (CDC §9). */
export const tl = {
  /** Bascule entre les deux modes plein écran. */
  modeEdition: 'Édition',
  modeLecture: 'Lecture',
  quitter: 'Quitter',
  fermer: 'Fermer',

  page: (n: number, total: number) => `${n} / ${total}`,
  acte: (n: number) => `Acte ${n}`,
  vide: 'Ce spectacle n’a pas encore de dialogue.',
  suite: '(suite)',

  /** Écran intercalaire au changement de décor. */
  changementDecor: 'Changement de décor',
  continuer: 'Appuyez pour continuer',

  /** Menu. */
  menu: 'Menu',
  texteplus: 'A+',
  textemoins: 'A−',
  taille: 'Taille du texte',
  inverser: 'Inverser les couleurs',
  debut: 'Revenir au début',
  testTouches: 'Tester ma pédale',

  /** Reprise à la position quittée. */
  reprendre: (page: number) => `Reprendre à la page ${page}`,
  recommencer: 'Recommencer depuis le début',

  /** Veille de l'écran. */
  veille: 'Pensez à désactiver la mise en veille de l’écran.',

  /** Page de test des touches (CDC §9). */
  test: {
    titre: 'Test de la pédale',
    aide:
      'Appuyez sur votre pédale ou sur une touche. La touche reçue s’affiche ci-dessous. '
      + 'Vérifiez qu’elle fait bien « page suivante » ou « page précédente ».',
    enAttente: 'En attente d’un appui…',
    recue: 'Touche reçue',
    effet: 'Effet dans le spectacle',
    effetSuivant: 'Page suivante',
    effetPrecedent: 'Page précédente',
    effetAucun: 'Aucun effet',
    ignoreRebond: 'Ignoré : appui trop rapproché du précédent',
    ignoreRepetition: 'Ignoré : touche maintenue enfoncée',
  },
} as const;

/**
 * Le mini tutoriel : trois étapes, ouvert par la carte « Premiers pas » du
 * studio ou par le bouton « Aide » de l'en-tête.
 *
 * Chaque étape dit quoi faire avec les libellés EXACTS de l'interface (en
 * gras dans l'affichage), puis une seule astuce. Un parent le lit une fois, en
 * une minute, et doit pouvoir le suivre sans rien deviner.
 */
export const ttu = {
  titre: 'Comment ça marche',
  etapeSur: (n: number, total: number) => `Étape ${n} sur ${total}`,
  precedent: 'Précédent',
  suivant: 'Suivant',
  terminer: 'C’est parti !',
  fermer: 'Fermer le tuto',
  ouvrirParametres: 'Ouvrir les Paramètres IA',
  astuce: 'Bon à savoir',

  /** La carte d'accueil, en haut du studio. */
  carte: {
    titre: 'Premier spectacle ?',
    resume: [
      'Créez vos marionnettes à partir des peluches de vos enfants.',
      'Choisissez-les pour le spectacle, réglez le studio et lancez la génération.',
      'Relisez le script, puis jouez-le en tournant les pages du pied.',
    ],
    ouvrir: 'Voir le tuto (1 minute)',
    masquer: 'Masquer',
  },

  /**
   * Les étapes. Dans `faire`, ce qui est entre ** ** s'affiche en gras : ce
   * sont les boutons et les zones à repérer à l'écran.
   */
  etapes: [
    {
      titre: 'Créez vos marionnettes',
      intro: 'Chaque peluche de la maison devient une marionnette. Vous la créez une fois, et elle sert à tous vos spectacles.',
      faire: [
        'Dans la colonne **Marionnethèque**, à gauche, cliquez sur **+ Nouvelle marionnette**.',
        'Donnez-lui un **nom**, et dites dans la **description** quel animal ou quel personnage c’est : « un lapin gris », « un petit dragon vert ».',
        'Choisissez de **1 à 6 traits** de caractère : gourmand, peureux, rusé…',
        'Si vous voulez, ajoutez sa **voix** et une **photo**, puis **Enregistrer**.',
      ],
      astuce: 'L’espèce et les traits décident des rôles qu’elle jouera : un lapin peureux trouvera le lièvre peureux de La Fontaine. La photo reste sur votre appareil.',
    },
    {
      titre: 'Préparez le studio et générez',
      intro: 'Le studio, au centre, réunit la troupe du jour et les réglages du spectacle.',
      faire: [
        'Avec la **flèche** sur le côté de chaque marionnette, envoyez-la dans les **Personnages**.',
        'Réglez la **durée**, l’**âge** des enfants, le nombre de **marionnettistes** — chacun a deux mains, donc deux marionnettes en scène — et l’**interaction avec le public**.',
        'Cliquez sur **Générer le script**, puis choisissez l’un des **trois contes** proposés.',
      ],
      astuce: 'L’écriture prend quelques minutes. Si vous avez une idée, écrivez-la dans l’ébauche (« une histoire au bord de la mer ») : les contes qui en parlent passent devant.',
    },
    {
      titre: 'Relisez, puis jouez',
      intro: 'Votre spectacle apparaît dans la colonne **Spectacles**, à droite. Il s’ouvre en deux modes.',
      faire: [
        'Le mode **Édition** sert à relire, corriger une réplique, **Régénérer cet acte**, préparer les décors et **Imprimer**.',
        'Le bouton **Jouer** ouvre le mode **Lecture**, en plein écran : les répliques à gauche, les gestes et les entrées à droite.',
        'Vos deux mains tiennent les marionnettes : tournez les pages avec la **barre Espace** — du pied, ou avec une pédale tourne-page branchée à l’ordinateur.',
        '**Flèche gauche** pour revenir en arrière, **M** pour le menu, **Échap** pour sortir.',
      ],
      astuce: 'Avant la représentation, faites l’essai : dans le menu (touche M), **Tester ma pédale** vérifie que chaque appui tourne bien une page.',
    },
  ],

  /**
   * La clé IA, rappelée à l'étape 2 dans un encadré à part : c'est ce qui
   * bloque la première génération. Isolé ici pour être remplacé le jour où
   * l'outil offrira des crédits d'essai.
   */
  cle: {
    etape: 1,
    titre: 'Une seule fois : votre clé IA',
    faire: [
      'Le Souffleur écrit avec une intelligence artificielle, qui a besoin d’une **clé API**. Nous conseillons **OpenRouter** : une seule clé donne accès à tous les modèles.',
      'Créez un compte sur openrouter.ai, ajoutez quelques euros de crédit — cela suffit pour de nombreux spectacles —, puis créez une clé.',
      'Dans **Paramètres IA**, en haut de l’écran, collez-la dans **Clé API**. Cochez **Mémoriser la clé sur cet appareil** si l’ordinateur est le vôtre, puis **Enregistrer**.',
    ],
  },

  /** Les touches dessinées à l'étape 3. */
  touches: [
    { touche: 'Espace', effet: 'page suivante' },
    { touche: '←', effet: 'page précédente' },
    { touche: 'M', effet: 'menu' },
    { touche: 'Échap', effet: 'sortir' },
  ],
} as const;
