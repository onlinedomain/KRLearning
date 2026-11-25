# 다독+ — lecteur de coréen gradué (usage personnel)

Version améliorée du *TOPIK GUIDE Graded Reader*, limitée aux **niveaux 1 à 4** (326 textes).
Appli web sans dépendance : HTML + CSS + JavaScript (modules), installable sur téléphone (PWA).

## Lancer l'appli sur l'ordinateur

```powershell
node tools/serve.mjs
```

Puis ouvre http://localhost:8080. (Double-cliquer sur `index.html` ne marche pas : le navigateur
bloque le chargement des textes hors serveur.)

Pour tester sur ton téléphone **sur le même Wi-Fi**, ouvre l'adresse « réseau local » affichée par la
commande. L'installation et le mode hors ligne demandent du **HTTPS**, donc un hébergement (ci-dessous).

## Mettre l'appli sur ton téléphone (installable + hors ligne)

Le dossier se publie tel quel sur n'importe quel hébergeur de sites statiques gratuit :

- **Netlify** : crée un compte, « Add new site → Deploy manually », glisse le dossier.
- **GitHub Pages** : dépôt (privé possible avec un compte payant, sinon public), Settings → Pages.
- **Cloudflare Pages** : « Upload assets », glisse le dossier.

Ensuite, sur le téléphone : ouvre l'URL → menu du navigateur → **Ajouter à l'écran d'accueil**.
Garde l'URL pour toi : les textes et l'audio appartiennent à TOPIK GUIDE.

> Fichiers inutiles à publier : `Nouveau document texte.*`, `tools/`, `README.md`, `.claude/`.

## Transférer ses données téléphone ↔ ordinateur

Menu ☰ → **Sauvegarde & transfert** :
- **Partager / télécharger le fichier** puis **Importer un fichier** sur l'autre appareil, ou
- **Copier un code de transfert** (texte compressé) puis **Coller un code** de l'autre côté.

À l'import, **Fusionner** combine les deux appareils (aucun mot perdu, progression maximale gardée).

## Structure

| Chemin | Rôle |
|---|---|
| `index.html`, `css/app.css` | Page et styles (4 styles × clair/sombre) |
| `js/app.js` | Menu burger, navigation, thème |
| `js/views/*.js` | Pages : bibliothèque, lecteur, banque, flashcards, stats, paramètres, sauvegarde |
| `js/store.js` | Données locales, fusion, code de transfert |
| `js/srs.js` | Répétition espacée des flashcards |
| `js/audio.js` | Voix enregistrée + surlignage, repli synthèse vocale |
| `js/text.js` | Découpage en phrases, alignement des traductions |
| `data/texts.json`, `data/meta.json` | Textes niveaux 1–4, minutages audio, thèmes |
| `sw.js`, `manifest.json`, `icons/` | Mode hors ligne et installation |
| `tools/` | Serveur local, génération des icônes, alignement des phrases |

L'audio enregistré est lu en ligne depuis le site de TOPIK GUIDE ; hors ligne, l'appli passe
automatiquement à la synthèse vocale du téléphone.
