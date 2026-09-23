/**
 * PL: Jedno źródło wersji aplikacji zgodne z Semantic Versioning (MAJOR.MINOR.PATCH).
 * EN: Single source of truth for the app version, following Semantic Versioning.
 *
 * Zmieniaj tylko wartość poniżej / Change only the value below.
 */
(() => {
  const version = "1.3.0";

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("APP_VERSION musi mieć format MAJOR.MINOR.PATCH");
  }

  globalThis.APP_VERSION = version;
})();
