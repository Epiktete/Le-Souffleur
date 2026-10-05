// Micro-serveur statique sans aucune dépendance, uniquement pour l'étape 0.
//
// Pourquoi un serveur alors que l'application finale est 100 % statique ?
// Parce qu'une page ouverte en double-cliquant (file://) envoie aux API une
// origine « null » que beaucoup de fournisseurs refusent. Le test du CORS
// serait alors faussé. En servant la page sur http://localhost, on reproduit
// une origine réaliste, proche de la future mise en ligne sur GitHub Pages.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = fileURLToPath(new URL('.', import.meta.url));
const PORT = 5500;
const TYPES = { '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

const serveur = createServer(async (req, res) => {
  // On retire la query string et on empêche de sortir du dossier (../).
  const chemin = decodeURIComponent(req.url.split('?')[0]);
  const relatif = normalize(chemin === '/' ? 'index.html' : chemin.slice(1)).replace(/^(\.\.[/\\])+/, '');
  try {
    const contenu = await readFile(join(DOSSIER, relatif));
    res.writeHead(200, { 'Content-Type': TYPES[extname(relatif)] ?? 'application/octet-stream' });
    res.end(contenu);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Fichier introuvable : ' + relatif);
  }
});

serveur.listen(PORT, () => {
  console.log(`Page de test de l'étape 0 : http://localhost:${PORT}`);
  console.log('Pour arrêter le serveur : Ctrl + C');
});
