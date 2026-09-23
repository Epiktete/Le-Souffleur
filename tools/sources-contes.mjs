// La liste des contes du répertoire, et où les trouver.
//
// Chaque entrée dit d'où vient le texte ORIGINAL, dans sa langue. Le script
// tools/telecharger-contes.mjs les récupère dans wiki/raw/. Les versions
// françaises (wiki/fr/) et les fiches (wiki/fiches/) sont écrites ensuite, à
// la main, à partir de ces textes.
//
// Tous ces textes sont dans le domaine public : auteurs, collecteurs et
// traducteurs morts depuis plus de soixante-dix ans, ou textes anonymes
// anciens. Le champ `droits` le justifie en une ligne.
//
// Types de source :
//   ws        une page de Wikisource (champ `wiki` : fr, de, ru, zh…)
//   gutenberg un livre du Projet Gutenberg, découpé entre deux titres
//   aozora    une fiche d'Aozora Bunko, la bibliothèque japonaise
//
// `extrait` (facultatif) : [début, fin] — on ne garde que le passage qui va
// du premier texte au second inclus. Sert aux classiques chinois, où une
// fable de trois lignes est noyée dans un chapitre entier.

const basset = (n, id, titre, peuple, pays) => ({
  id: `afr-${id}`,
  titre,
  culture: `${peuple} (${pays})`,
  continent: 'Afrique',
  langue: 'fr',
  collecteur: 'René Basset, Contes populaires d’Afrique, 1903',
  droits: 'Basset (1855-1924) : domaine public',
  source: { type: 'ws', wiki: 'fr', page: `Contes populaires d’Afrique (Basset)/${n}` },
});

const grimm = (id, titre, page) => ({
  id: `de-${id}`,
  titre,
  titreOriginal: page.replace(/ \(1857\)$/, ''),
  culture: 'Allemagne',
  continent: 'Europe',
  langue: 'de',
  collecteur: 'Jacob et Wilhelm Grimm, Kinder- und Hausmärchen, 1857',
  droits: 'Grimm (1785-1863, 1786-1859) : domaine public',
  source: { type: 'ws', wiki: 'de', page },
});

const afanassiev = (id, titre, page) => ({
  id: `ru-${id}`,
  titre,
  titreOriginal: page,
  culture: 'Russie',
  continent: 'Europe',
  langue: 'ru',
  collecteur: 'Alexandre Afanassiev, Contes populaires russes, 1855-1863',
  droits: 'Afanassiev (1826-1871) : domaine public',
  source: { type: 'ws', wiki: 'ru', page: `Народные русские сказки (Афанасьев)/${page}` },
});

const andersen = (id, titre, page) => ({
  id: `dk-${id}`,
  titre,
  titreOriginal: page,
  culture: 'Danemark',
  continent: 'Europe',
  langue: 'da',
  collecteur: 'Hans Christian Andersen, Eventyr',
  droits: 'Andersen (1805-1875) : domaine public',
  source: { type: 'ws', wiki: 'da', page },
});

const norvege = (id, titre, page) => ({
  id: `no-${id}`,
  titre,
  titreOriginal: page,
  culture: 'Norvège',
  continent: 'Europe',
  langue: 'no',
  collecteur: 'Peter Christen Asbjørnsen et Jørgen Moe, Norske Folkeeventyr',
  droits: 'Asbjørnsen (1812-1885), Moe (1813-1882) : domaine public',
  source: { type: 'ws', wiki: 'no', page },
});

const jacobs = (id, titre, page) => ({
  id: `en-${id}`,
  titre,
  titreOriginal: page,
  culture: 'Angleterre',
  continent: 'Europe',
  langue: 'en',
  collecteur: 'Joseph Jacobs, English Fairy Tales, 1890',
  droits: 'Jacobs (1854-1916) : domaine public',
  source: { type: 'ws', wiki: 'en', page: `English Fairy Tales/${page}` },
});

const nasreddin = (id, titre, page) => ({
  id: `tr-${id}`,
  titre,
  titreOriginal: page,
  culture: 'Turquie',
  continent: 'Asie',
  langue: 'tr',
  collecteur: 'Tradition orale, fıkras de Nasreddin Hodja',
  droits: 'Anecdotes traditionnelles anonymes ; transcription Wikisource sous licence libre',
  source: { type: 'ws', wiki: 'tr', page },
});

const chine = (id, titre, titreOriginal, livre, page, extrait) => ({
  id: `zh-${id}`,
  titre,
  titreOriginal,
  culture: 'Chine',
  continent: 'Asie',
  langue: 'zh',
  collecteur: livre,
  droits: 'Texte classique chinois antérieur au XVIIIe siècle : domaine public',
  source: { type: 'ws', wiki: 'zh', page },
  extrait,
});

const japon = (id, titre, titreOriginal, carte) => ({
  id: `ja-${id}`,
  titre,
  titreOriginal,
  culture: 'Japon',
  continent: 'Asie',
  langue: 'ja',
  collecteur: 'Kusuyama Masao, Nihon mukashibanashi',
  droits: 'Kusuyama Masao (1884-1950) : domaine public',
  source: { type: 'aozora', carte: `https://www.aozora.gr.jp/cards/000329/card${carte}.html` },
});

const gutenberg = (id, titre, titreOriginal, culture, continent, collecteur, droits, livre, debut, fin) => ({
  id,
  titre,
  titreOriginal,
  culture,
  continent,
  langue: 'en',
  collecteur,
  droits,
  source: { type: 'gutenberg', livre, debut, fin },
});

export const CONTES = [
  /* ------------------------------------------------------------------ */
  /* Théâtre de marionnettes                                             */
  /* ------------------------------------------------------------------ */
  ...[
    ['le-chateau-mysterieux', 'Le Château mystérieux'],
    ['le-duel', 'Le Duel'],
    ['le-marchand-de-veaux', 'Le Marchand de veaux'],
    ['le-portrait-de-l-oncle', 'Le Portrait de l’oncle'],
    ['le-pot-de-confitures', 'Le Pot de confitures'],
    ['le-testament', 'Le Testament'],
    ['les-couverts-voles', 'Les Couverts Volés'],
    ['les-freres-coq', 'Les Frères Coq'],
    ['les-souterrains-du-vieux-chateau', 'Les Souterrains du vieux château'],
    ['l-enrolement', 'L’Enrôlement'],
    ['ma-porte-d-allee', 'Ma porte d’allée'],
    ['tu-chanteras-tu-ne-chanteras-pas', 'Tu chanteras, tu ne chanteras pas'],
  ].map(([id, titre]) => ({
    id: `guignol-${id}`,
    titre,
    culture: 'Lyon (France)',
    continent: 'Europe',
    langue: 'fr',
    genre: 'pièce de marionnettes',
    collecteur: 'J.-B. Onofrio, Théâtre lyonnais de Guignol, 1865-1870',
    droits: 'Onofrio (1814-1892) : domaine public',
    source: { type: 'ws', wiki: 'fr', page: `Théatre lyonnais de Guignol/${titre}` },
  })),
  {
    id: 'en-punch-et-judy',
    titre: 'Punch et Judy',
    titreOriginal: 'The Tragical Acts, or Comical Tragedies of Punch and Judy',
    culture: 'Angleterre',
    continent: 'Europe',
    langue: 'en',
    genre: 'pièce de marionnettes',
    collecteur: 'W. J. Judd, d’après le texte de John Payne Collier (1828), 1879',
    droits: 'Publié en 1879 ; Collier (1789-1883) : domaine public',
    source: { type: 'gutenberg', livre: 48171, debut: 'ACT I.', fin: 'ACT III.' },
  },

  /* ------------------------------------------------------------------ */
  /* France                                                              */
  /* ------------------------------------------------------------------ */
  ...[
    ['chaperon-rouge', 'Le Petit Chaperon rouge', 'Le petit Chaperon rouge'],
    ['chat-botte', 'Le Chat botté', 'Le maître Chat ou le Chat botté'],
    ['les-fees', 'Les Fées', 'Les Fées'],
    ['petit-poucet', 'Le Petit Poucet', 'Le Petit Poucet'],
    ['cendrillon', 'Cendrillon', 'Cendrillon ou la petite Pantoufle de verre'],
    ['riquet', 'Riquet à la houppe', 'Riquet à la Houppe'],
  ].map(([id, titre, page]) => ({
    id: `fr-perrault-${id}`,
    titre,
    culture: 'France',
    continent: 'Europe',
    langue: 'fr',
    collecteur: 'Charles Perrault, Histoires ou contes du temps passé, 1697',
    droits: 'Perrault (1628-1703) : domaine public',
    source: { type: 'ws', wiki: 'fr', page: `Contes de Perrault (éd. 1902)/${page}` },
  })),
  ...[
    ['corbeau-renard', 'Le Corbeau et le Renard'],
    ['cigale-fourmi', 'La Cigale et la Fourmi'],
    ['lievre-tortue', 'Le Lièvre et la Tortue'],
    ['loup-chien', 'Le Loup et le Chien'],
    ['renard-cigogne', 'Le Renard et la Cigogne'],
    ['lion-rat', 'Le Lion et le Rat'],
    ['rat-ville-champs', 'Le Rat de Ville, et le Rat des Champs'],
    ['renard-bouc', 'Le Renard et le Bouc'],
    ['laitiere', 'La Laitière et le Pot au lait'],
    ['meunier-fils-ane', 'Le Meunier, son Fils, et l’Âne'],
    ['coche-mouche', 'Le Coche et la Mouche'],
    ['grenouille-boeuf', 'La Grenouille qui se veut faire aussi grosse que le Bœuf'],
    // Fables à un seul personnage principal, pour les spectacles à une
    // marionnette.
    ['renard-raisins', 'Le Renard et les Raisins'],
    ['loup-berger', 'Le Loup devenu Berger'],
    ['lievre-grenouilles', 'Le Lièvre et les Grenouilles'],
    ['cerf-dans-l-eau', 'Le Cerf se voyant dans l’eau'],
    ['rat-huitre', 'Le Rat et l’Huître'],
    ['ane-peau-lion', 'L’Âne vêtu de la peau du Lion'],
    ['geai-plumes-paon', 'Le Geai paré des plumes du Paon'],
    ['corbeau-aigle', 'Le Corbeau voulant imiter l’Aigle'],
  ].map(([id, titre]) => ({
    id: `fr-fontaine-${id}`,
    titre,
    culture: 'France',
    continent: 'Europe',
    langue: 'fr',
    genre: 'fable',
    collecteur: 'Jean de La Fontaine, Fables, 1668-1694',
    droits: 'La Fontaine (1621-1695) : domaine public',
    source: { type: 'ws', wiki: 'fr', page: `Fables de La Fontaine (éd. 1874)/${titre}` },
  })),
  {
    id: 'ar-ali-baba',
    titre: 'Ali Baba et les quarante voleurs',
    culture: 'Monde arabe (Syrie)',
    continent: 'Asie',
    langue: 'fr',
    collecteur: 'Antoine Galland, Les Mille et Une Nuits, 1704-1717, d’après le conteur alépin Hanna Diyab',
    droits: 'Galland (1646-1715) : domaine public. Le texte de Galland est l’original : il n’existe pas de manuscrit arabe antérieur.',
    source: { type: 'ws', wiki: 'fr', page: 'Les Mille et Une Nuits/Histoire d’Ali Baba' },
  },

  /* ------------------------------------------------------------------ */
  /* Afrique — Basset donne des traductions françaises faites sur les     */
  /* langues d'origine, qui ne s'écrivaient pas ou peu à l'époque.        */
  /* ------------------------------------------------------------------ */
  basset(1, 'lion-et-souris', 'Le Lion et la Souris', 'Égyptien ancien', 'Égypte'),
  basset(5, 'djaha-et-sa-femme', 'Djah’a et sa femme', 'Berbère de Ghat', 'Libye'),
  basset(9, 'assemblee-des-animaux', 'Le Lion, le Chacal, le Mulet et l’assemblée des animaux', 'Kabyle', 'Algérie'),
  basset(14, 'gueule-tapee-hyene-lion', 'La Gueule tapée, la Hyène et le Lion', 'Berbère', 'Sénégal'),
  basset(19, 'moineau-et-poule', 'Le Moineau et la Poule', 'Haoussa', 'Nigeria, Niger'),
  basset(22, 'renard-babouin-lion', 'Le Renard, le Babouin et le Lion', 'Bilin', 'Érythrée'),
  basset(28, 'souris-et-grenouille', 'La Souris et la Grenouille', 'Kunama', 'Érythrée'),
  basset(30, 'lion-leopard-singe', 'Le Lion, le Léopard et le Singe', 'Oromo', 'Éthiopie'),
  basset(34, 'vieille-femme-et-lion', 'La Vieille Femme et le Lion', 'Somali', 'Somalie'),
  basset(52, 'singe-et-bucheron', 'Le Singe et le Bûcheron', 'Nubien de Dongola', 'Soudan'),
  basset(55, 'coq-et-elephant', 'Le Coq et l’Éléphant', 'Dinka', 'Soudan du Sud'),
  basset(57, 'lievre-bari', 'Le Lièvre', 'Bari', 'Soudan du Sud'),
  basset(64, 'belette-et-hyene', 'La Belette et la Hyène', 'Kanouri', 'Bornou, Tchad'),
  basset(68, 'hyene-et-lievre', 'La Hyène et le Lièvre', 'Mandé', 'Mali'),
  basset(69, 'lievre-gris-gris', 'Le Lièvre et son gris-gris', 'Malinké', 'Guinée, Mali'),
  basset(70, 'qui-est-le-plus-fort', 'Qui est le plus fort ?', 'Soninké', 'Mali, Sénégal'),
  basset(72, 'araignee-vai', 'L’Araignée', 'Vaï', 'Liberia'),
  basset(74, 'lievre-et-moineaux', 'Le Lièvre et les Moineaux', 'Wolof', 'Sénégal'),
  basset(82, 'cameleon-et-crapaud', 'Le Caméléon et le Crapaud', 'Agni', 'Côte d’Ivoire'),
  basset(88, 'singes-dans-les-arbres', 'Pourquoi les singes habitent dans les arbres', 'Éwé', 'Togo, Ghana'),
  basset(89, 'caille-et-crabe', 'La Caille et le Crabe', 'Atakpamé', 'Togo'),
  basset(90, 'lezard-et-tortue', 'Le Lézard et la Tortue', 'Yoruba (Nago)', 'Bénin, Nigeria'),
  basset(94, 'arret-du-babouin', 'L’Arrêt du babouin', 'Nama', 'Namibie'),
  basset(99, 'lievre-hyene-lion', 'Le Lièvre, la Hyène et le Lion', 'Swahili', 'Zanzibar, Tanzanie'),
  basset(108, 'tortue-et-elephant', 'La Tortue et l’Éléphant', 'Konde', 'Malawi, Tanzanie'),
  basset(118, 'courge-qui-parle', 'La Courge qui parle', 'Shambala', 'Tanzanie'),
  basset(121, 'lievre-et-rainette', 'Le Lièvre et la Rainette', 'Ronga', 'Mozambique'),
  basset(135, 'elephant-et-tortue', 'L’Éléphant et la Tortue', 'Herero', 'Namibie'),
  basset(143, 'crocodile-et-poule', 'Pourquoi le crocodile ne mange pas la poule', 'Kongo (Fiote)', 'Congo'),
  basset(147, 'panthere-chien-tortue', 'La Panthère, le Chien et la Tortue', 'Téké', 'Congo, Gabon'),
  basset(154, 'cameleon-et-araignee', 'Le Caméléon et l’Araignée', 'Dagomba', 'Ghana'),
  basset(159, 'chat-sauvage-et-rat', 'Le Chat sauvage et le Rat', 'Merina (Hova)', 'Madagascar'),
  basset(167, 'anansi-tigre-chevre', 'Anansi, le Tigre et la Chèvre', 'Afro-antillais', 'Antilles anglaises'),
  ...[
    ['tar-baby', 'Le Bébé de goudron', 'The Wonderful Tar-Baby Story'],
    ['lapin-trop-malin', 'Frère Lapin et le buisson de ronces', 'How Mr. Rabbit was too sharp for Mr. Fox'],
  ].map(([id, titre, page]) => ({
    id: `us-remus-${id}`,
    titre,
    titreOriginal: page,
    culture: 'Afro-américain (sud des États-Unis)',
    continent: 'Amérique',
    langue: 'en',
    collecteur: 'Joel Chandler Harris, Uncle Remus: His Songs and His Sayings, 1880',
    droits: 'Harris (1848-1908) : domaine public',
    source: { type: 'ws', wiki: 'en', page: `Uncle Remus: His Songs and His Sayings/${page}` },
  })),

  /* ------------------------------------------------------------------ */
  /* Europe                                                              */
  /* ------------------------------------------------------------------ */
  grimm('musiciens-de-breme', 'Les Musiciens de Brême', 'Die Bremer Stadtmusikanten (1857)'),
  grimm('lievre-et-herisson', 'Le Lièvre et le Hérisson', 'Der Hase und der Igel (1857)'),
  grimm('loup-et-sept-chevreaux', 'Le Loup et les sept chevreaux', 'Der Wolf und die sieben jungen Geislein (1857)'),
  grimm('bouillie-sucree', 'La Bouillie sucrée', 'Der süße Brei (1857)'),
  // Un seul personnage principal, pour les spectacles à une marionnette.
  grimm('etoiles-d-argent', 'Les Étoiles d’argent', 'Die Sternthaler (1857)'),
  grimm('vaillant-petit-tailleur', 'Le Vaillant Petit Tailleur', 'Das tapfere Schneiderlein (1857)'),
  grimm('tracassin', 'Tracassin', 'Rumpelstilzchen (1857)'),
  grimm('table-ane-baton', 'La Table, l’Âne et le Bâton', 'Tischchen deck dich, Goldesel, und Knüppel aus dem Sack (1857)'),
  grimm('lutins-cordonnier', 'Les Lutins et le cordonnier', 'Die Wichtelmänner (1857)'),
  grimm('dame-holle', 'Dame Holle', 'Frau Holle (1857)'),
  grimm('chat-et-souris-associes', 'Chat et souris associés', 'Katze und Maus in Gesellschaft (1857)'),
  grimm('roitelet-et-ours', 'Le Roitelet et l’Ours', 'Der Zaunkönig und der Bär (1857)'),
  grimm('elise-la-maligne', 'Élise la maligne', 'Die kluge Else (1857)'),
  grimm('jean-la-chance', 'Jean la Chance', 'Hans im Glück (1857)'),
  grimm('roi-grenouille', 'Le Roi grenouille', 'Der Froschkönig oder der eiserne Heinrich (1857)'),
  grimm('hansel-et-gretel', 'Hansel et Gretel', 'Hänsel und Grethel (1857)'),
  grimm('renard-et-oies', 'Le Renard et les Oies', 'Der Fuchs und die Gänse (1857)'),

  andersen('habits-neufs-empereur', 'Les Habits neufs de l’empereur', 'Keiserens nye Klæder'),
  andersen('princesse-au-petit-pois', 'La Princesse au petit pois', 'Prindsessen paa Ærten'),
  andersen('vilain-petit-canard', 'Le Vilain Petit Canard', 'Den grimme Ælling'),
  andersen('ce-que-fait-le-vieux', 'Ce que fait le vieux est bien fait', 'Hvad Fatter gjør, det er altid det Rigtige'),
  andersen('soldat-de-plomb', 'L’Intrépide Soldat de plomb', 'Den standhaftige Tinsoldat'),

  norvege('trois-boucs', 'Les Trois Boucs Bruse', 'De tre bukkene Bruse som skulde til seters og gjøre sig fete'),
  norvege('concours-de-manger', 'Askeladden qui mangea plus que le troll', 'Askeladden som kappåt med trollet'),
  norvege('maitre-de-maison', 'Le Maître de la maison', 'Han far sjøl i stua'),

  afanassiev('kolobok', 'Le Petit Pain rond', 'Колобок'),
  afanassiev('navet', 'Le Navet', 'Репка'),
  afanassiev('maison-de-la-mouche', 'La Maison de la mouche', 'Терем мухи'),
  afanassiev('chat-coq-renard', 'Le Chat, le Coq et le Renard', 'Кот, петух и лиса'),
  afanassiev('renard-et-grue', 'Le Renard et la Grue', 'Лиса и журавль'),
  afanassiev('grue-et-heron', 'La Grue et le Héron', 'Журавль и цапля'),
  afanassiev('hiver-des-betes', 'L’Hiver des bêtes', 'Зимовье зверей'),
  afanassiev('renard-et-tetras', 'Le Renard et le Tétras', 'Лиса и тетерев'),
  afanassiev('renard-lievre-coq', 'Le Renard, le Lièvre et le Coq', 'Лиса, заяц и петух'),
  afanassiev('morozko', 'Morozko', 'Морозко'),
  afanassiev('paysan-ours-renard', 'Le Paysan, l’Ours et le Renard', 'Мужик, медведь и лиса'),
  afanassiev('ours-et-loups-effrayes', 'L’Ours et les Loups effrayés', 'Напуганные медведь и волки'),
  afanassiev('snegourouchka', 'Snégourouchka et le Renard', 'Снегурушка и лиса'),

  jacobs('trois-petits-cochons', 'Les Trois Petits Cochons', 'The Story of the Three Little Pigs'),
  jacobs('jack-haricot', 'Jack et le haricot magique', 'Jack and the Beanstalk'),
  jacobs('trois-ours', 'Les Trois Ours', 'The Story of the Three Bears'),
  jacobs('henny-penny', 'Poulette Pioupiou', 'Henny-Penny'),
  jacobs('maitre-des-maitres', 'Le Maître des maîtres', 'Master of all Masters'),
  jacobs('jacques-le-paresseux', 'Jacques le Paresseux', 'Lazy Jack'),
  jacobs('vieille-et-cochon', 'La Vieille et son cochon', 'The Old Woman and her Pig'),
  jacobs('trois-nigauds', 'Les Trois Nigauds', 'The Three Sillies'),

  {
    id: 'es-raton-perez',
    titre: 'Le Rat Pérez',
    titreOriginal: 'Ratón Pérez',
    culture: 'Espagne',
    continent: 'Europe',
    langue: 'es',
    collecteur: 'Luis Coloma, 1894, d’après la tradition',
    droits: 'Coloma (1851-1915) : domaine public',
    source: { type: 'ws', wiki: 'es', page: 'Ratón Pérez' },
  },
  {
    id: 'it-giufa',
    titre: 'Une histoire de Giufà',
    titreOriginal: 'Una storia di Giufà',
    culture: 'Sicile (Italie)',
    continent: 'Europe',
    langue: 'it',
    collecteur: 'Venerando Gangi, 1845, d’après la tradition sicilienne',
    droits: 'Gangi (1748-1816) : domaine public',
    source: { type: 'ws', wiki: 'it', page: 'Una storia di Giufà' },
  },

  /* ------------------------------------------------------------------ */
  /* Asie                                                                */
  /* ------------------------------------------------------------------ */
  nasreddin('mange-mon-manteau', 'Mange, mon manteau !', 'Ye Kürküm Ye'),
  nasreddin('marmite-a-accouche', 'La Marmite a accouché', 'Kazan Doğurdu'),
  nasreddin('levain-dans-le-lac', 'Du levain dans le lac', 'Göle Maya Çalmak'),
  nasreddin('qui-paie-joue-du-sifflet', 'Qui paie joue du sifflet', 'Parayı Veren Düdüğü Çalar'),

  chine('renard-et-tigre', 'Le Renard qui emprunte la force du tigre', '狐假虎威', 'Stratagèmes des Royaumes combattants, Ier s. av. J.-C.', '戰國策/卷14', ['虎求百獸而食之', '以為畏狐也']),
  chine('serpent-et-pattes', 'Ajouter des pattes au serpent', '畫蛇添足', 'Stratagèmes des Royaumes combattants', '戰國策/卷09', ['楚有祠者', '終亡其酒']),
  chine('becasseau-et-moule', 'La Bécassine et la Moule', '鷸蚌相爭', 'Stratagèmes des Royaumes combattants', '戰國策/卷30', ['蚌方出曝', '并禽之']),
  chine('automate-de-yanshi', 'L’Automate de Yan Shi', '偃師造人', 'Liezi, IVe s.', '列子/湯問篇', ['周穆王西巡狩', '而時執規矩。']),
  chine('grenouille-du-puits', 'La Grenouille du vieux puits', '埳井之蛙', 'Zhuangzi, IVe s. av. J.-C.', '莊子/秋水', ['子獨不聞夫埳井之鼃乎', '規規然自失也']),
  chine('tirer-les-pousses', 'Tirer sur les pousses pour les faire grandir', '揠苗助長', 'Mencius, IVe s. av. J.-C.', '孟子/公孫丑上', ['宋人有閔其苗之不長而揠之者', '苗則槁矣']),
  chine('lance-et-bouclier', 'La Lance et le Bouclier', '自相矛盾', 'Han Feizi', '韓非子/難一', ['楚人有鬻楯與矛者', '其人弗能應也']),
  chine('seigneur-qui-aimait-les-dragons', 'Le Seigneur qui aimait les dragons', '葉公好龍', 'Xinxu, Ier s. av. J.-C.', '新序/雜事/卷五', ['葉公子高好龍', '好夫似龍而非龍者也']),
  chine('poirier-magique', 'Le Poirier magique', '種梨', 'Pu Songling, Contes extraordinaires du pavillon du loisir, 1740', '聊齋志異/第01卷', ['有鄉人貨梨於市', '又何足怪？']),
  chine('taoiste-du-mont-lao', 'Le Taoïste du mont Lao', '勞山道士', 'Pu Songling, Contes extraordinaires du pavillon du loisir, 1740', '聊齋志異/第01卷', ['邑有王生', '不止也。']),

  japon('momotaro', 'Momotarō, le garçon né d’une pêche', '桃太郎', '18376'),
  japon('singe-et-crabe', 'Le Singe et le Crabe', '猿かに合戦', '18334'),
  japon('moineau-langue-coupee', 'Le Moineau à la langue coupée', '舌切りすずめ', '18378'),
  japon('vieux-qui-faisait-fleurir', 'Le Vieux qui faisait fleurir les arbres', '花咲かじじい', '3391'),
  japon('issun-boshi', 'Issun-bōshi, le garçon pas plus haut qu’un pouce', '一寸法師', '43457'),
  japon('bosse-enlevee', 'La Bosse enlevée', '瘤とり', '43461'),
  japon('bouilloire-tanuki', 'La Bouilloire du tanuki', '文福茶がま', '18336'),
  japon('mariage-souris', 'Le Mariage de la souris', 'ねずみの嫁入り', '18335'),
  japon('meduse-messagere', 'La Méduse messagère', 'くらげのお使い', '18379'),
  japon('bonze-et-novice', 'Le Bonze et le petit novice', '和尚さんと小僧', '18387'),
  japon('brin-de-paille', 'Le Brin de paille', '一本のわら', '43458'),

  ...[
    ['tigre-mal-eleve', 'Le Tigre mal élevé', 'The Unmannerly Tiger', 'THE UNMANNERLY TIGER', 'TOKGABI AND HIS PRANKS'],
    ['vieux-moustaches-et-lapin', 'Vieilles Moustaches Blanches et Monsieur Lapin', 'Old White Whiskers and Mr. Bunny', 'OLD WHITE WHISKERS AND MR. BUNNY', 'THE KING OF THE FLOWERS'],
  ].map(([id, titre, original, debut, fin]) => gutenberg(
    `ko-${id}`, titre, original, 'Corée', 'Asie',
    'William Elliot Griffis, Korean Fairy Tales, 1922, d’après la tradition coréenne',
    'Griffis (1843-1928) : domaine public', 67180, debut, fin,
  )),

  ...[
    ['crocodile-et-singe', 'Le Crocodile et le Singe', 'The Crocodile and the Monkey', 'THE CROCODILE AND THE MONKEY', 'THE AXE, THE DRUM, THE BOWL, AND THE DIAMOND'],
    ['tortue-bavarde', 'La Tortue bavarde', 'The Talkative Tortoise', 'THE TALKATIVE TORTOISE', 'THE MONKEYS AND THE GARDENER'],
    ['singes-jardiniers', 'Les Singes jardiniers', 'The Monkeys and the Gardener', 'THE MONKEYS AND THE GARDENER', 'THE GOBLIN AND THE SNEEZE'],
    ['caille-et-faucon', 'La Caille et le Faucon', 'The Quail and the Falcon', 'THE QUAIL AND THE FALCON', 'PRIDE MUST HAVE A FALL'],
  ].map(([id, titre, original, debut, fin]) => gutenberg(
    `in-${id}`, titre, original, 'Inde (Jātaka bouddhiques)', 'Asie',
    'W. H. D. Rouse, The Giant Crab and Other Tales from Old India, 1897, d’après les Jātaka en pali',
    'Rouse (1863-1950) : domaine public', 36039, debut, fin,
  )),

  /* ------------------------------------------------------------------ */
  /* Amériques                                                           */
  /* ------------------------------------------------------------------ */
  ...[
    ['raton-laveur-et-ecrevisse', 'Le Raton laveur et l’Écrevisse', 'The Raccoon and the Crawfish', 'THE RACCOON AND THE CRAWFISH', 'LEGEND OF STANDING ROCK'],
    ['lapin-et-wapiti', 'Le Lapin et le Wapiti', 'The Rabbit and the Elk', 'THE RABBIT AND THE ELK', 'THE RABBIT AND THE GROUSE GIRLS'],
  ].map(([id, titre, original, debut, fin]) => gutenberg(
    `sioux-${id}`, titre, original, 'Sioux (Lakota, Dakota)', 'Amérique',
    'Marie L. McLaughlin, Myths and Legends of the Sioux, 1916',
    'McLaughlin (1842-1933) : domaine public', 341, debut, fin,
  )),
];
