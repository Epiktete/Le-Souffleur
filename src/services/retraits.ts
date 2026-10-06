// Décisions éditoriales communes au fonds et au générateur. Les sources
// littéraires restent dans le wiki ; une œuvre retirée n'est plus jouable.
import RETRAITS_BRUTS from '../../wiki/retraits.json?raw';

export const RETRAITS = JSON.parse(RETRAITS_BRUTS) as Record<string, {
  date: string;
  motif: string;
}>;

export function conteEstRetire(id: string): boolean {
  return Object.hasOwn(RETRAITS, id);
}
