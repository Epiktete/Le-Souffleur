// IndexedDB et crypto.randomUUID ne sont pas fournis par Node : on les ajoute
// pour que les tests du service de stockage tournent sans navigateur.
import 'fake-indexeddb/auto';
