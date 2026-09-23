# Twój plan zajęć

Lokalna aplikacja do układania, przeglądania i eksportowania planu zajęć. Nie wymaga backendu, a po pierwszym poprawnym załadowaniu działa również offline.

## Struktura projektu

```text
.
├── index.html                         # Struktura interfejsu / UI structure
├── service-worker.js                  # Powłoka offline / Offline app shell
├── app-icon.png
└── assets
    ├── css
    │   └── app.css                    # Design system, layout i druk / Design system, layout, print
    ├── fonts                          # Lokalne fonty Roboto / Local Roboto fonts
    └── js
        ├── version.js                 # Jedyne źródło numeru wersji / Version source of truth
        ├── editor.js                  # Tabela i edycja / Table and editing
        ├── state-and-export.js        # Zapis, historia, import i eksport / State, history, import, export
        ├── text-formatting.js         # Formatowanie komórek / Cell formatting
        ├── schedule-and-settings.js   # Tygodnie, moduły obszarowe i ustawienia / Weeks, area modules, settings
        └── theme-preview-bootstrap.js # Motyw, podgląd mobilny i start / Theme, mobile preview, bootstrap
```

Skrypty są celowo ładowane jako zwykłe skrypty przeglądarkowe w kolejności widocznej w `index.html`. Dzięki temu refaktor nie zmienia formatu danych ani działania istniejących handlerów HTML.

## Zmiana wersji

Projekt używa [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

Zmień wyłącznie wartość `version` w pliku `assets/js/version.js`:

```js
const version = "1.2.0";
```

- `MAJOR` — zmiana niezgodna wstecznie;
- `MINOR` — nowa funkcja zgodna wstecznie;
- `PATCH` — poprawka błędu zgodna wstecznie.

Ta jedna wartość aktualizuje automatycznie numer w stopce, metadane eksportu JSON oraz nazwę cache Service Workera. Nie dopisuj numeru wersji do tytułu strony.

## Uruchamianie lokalne

Service Worker wymaga serwera HTTP. Najprostszy podgląd:

```bash
python3 -m http.server 8080
```

Następnie otwórz `http://localhost:8080/`. Samo otwarcie `index.html` przez `file://` pozwala sprawdzić większość interfejsu, ale nie pełne działanie offline.

## Formatowanie kodu

Konfiguracja Prettier znajduje się w `.prettierrc.json`. Opcjonalnie:

```bash
npm install
npm run format:check
npm run format
```

Komentarze wyjaśniające decyzje architektoniczne zapisujemy po polsku i angielsku (`PL:` / `EN:`). Nie komentujemy każdej oczywistej instrukcji — komentarz ma wyjaśniać powód albo nietypowe zachowanie.

## Ważne zasady

- Dane użytkownika i ustawienia pozostają w pamięci przeglądarki; refaktor nie może zmieniać istniejących kluczy bez migracji.
- Interfejs aplikacji i dokument A4 to osobne warstwy. Motyw aplikacji nie może zmieniać wydruku.
- Wszystkie zasoby potrzebne offline muszą znaleźć się w `SHELL_ASSETS` w `service-worker.js`.
- Po zmianie kodu sprawdź co najmniej składnię JS, formatowanie, widoki mobilny i desktopowy, light/dark/system, druk oraz ponowne uruchomienie offline.
