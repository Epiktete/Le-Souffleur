import type { TypeRecit } from '../services/rechercheBanque';

// Garder les critères pendant la navigation et les changements de disposition
// (onglets mobiles, rotation du téléphone), sans les enregistrer durablement.
export const rechercheBanque = $state({
  texte: '',
  type: '' as TypeRecit | '',
  origine: '',
});
