// Publie une photographie du commit privé, jamais son historique Git.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, sep } from 'node:path';

const racine = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const initiale = process.argv.includes('--preparer-initiale');
const publicUrl = 'https://github.com/Epiktete/Le-Souffleur.git';
const git = (dossier, ...args) => execFileSync('git', ['-C', dossier, ...args], { encoding: 'utf8' }).trim();
const origin = git(racine, 'remote', 'get-url', 'origin');
if (!initiale && origin !== 'https://github.com/Epiktete/Le-Souffleur-dev.git') {
  throw new Error('Cette commande doit partir du dépôt privé Le-Souffleur-dev.');
}
if (git(racine, 'status', '--porcelain')) {
  throw new Error('Enregistrez les changements avant de publier : seul le commit HEAD est exporté.');
}

const source = git(racine, 'rev-parse', 'HEAD');
const sorties = join(racine, 'test-results');
mkdirSync(sorties, { recursive: true });
const travail = mkdtempSync(join(sorties, 'publication-'));
const depot = join(travail, 'public');
const archive = join(travail, 'version.tar');
git(racine, 'archive', '--format=tar', `--output=${archive}`, source);

if (initiale) {
  mkdirSync(depot);
  git(depot, 'init', '--initial-branch=main');
  git(depot, 'remote', 'add', 'origin', publicUrl);
} else {
  execFileSync('git', ['clone', '--single-branch', '--branch', 'main', publicUrl, depot], { stdio: 'inherit' });
  const cible = realpathSync(depot);
  if (!cible.startsWith(realpathSync(sorties) + sep)) throw new Error('Dossier de publication hors du projet.');
  for (const entree of readdirSync(cible)) {
    if (entree === '.git') continue;
    const chemin = resolve(cible, entree);
    if (!chemin.startsWith(cible + sep)) throw new Error('Chemin de nettoyage invalide.');
    rmSync(chemin, { recursive: true, force: true });
  }
}
execFileSync('tar', ['-xf', archive, '-C', depot], { stdio: 'inherit' });
for (const cle of ['user.name', 'user.email']) git(depot, 'config', cle, git(racine, 'config', '--get', cle));
git(depot, 'add', '--all');
if (git(depot, 'status', '--porcelain')) {
  git(depot, 'commit', '-m', initiale ? 'Première version publique du Souffleur' : 'Publie une nouvelle version du Souffleur');
  if (!initiale) execFileSync('git', ['-C', depot, 'push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
} else {
  console.log('La version publique contient déjà ces fichiers.');
}
console.log(JSON.stringify({ depot, source, commitPublic: git(depot, 'rev-parse', 'HEAD'), publie: !initiale }));
