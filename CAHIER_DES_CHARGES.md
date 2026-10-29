# Cahier des charges : sendLetter

> Version 1.1, 29 octobre 2026 (ajout de l'historique et de la gestion des comptes)

## 1. Présentation

sendLetter permet d'envoyer une **lettre scellée et éphémère**. L'expéditeur prépare sa lettre
sur une page privée et obtient un lien court. Le destinataire ouvre le lien, brise le sceau d'une
enveloppe en 3D avec un marteau, puis lit la lettre. Quelques minutes après sa première ouverture,
la lettre disparaît définitivement.

Le projet réunit trois anciennes variantes du même code (Invitation, Anniversaire, Crush) en une
seule application, où chaque variante devient un **type de lettre**.

## 2. Objectifs

| Objectif | Description |
|---|---|
| Une seule application | Un seul code pour les trois types de lettre ; seuls les textes, la palette, l'effet et les champs changent. |
| Envoi réservé | Seuls les comptes Google autorisés peuvent créer des lettres. |
| Lecture sans compte | Le destinataire n'a besoin que du lien. |
| Éphémère | La lettre n'est lisible que pendant une durée courte après sa première ouverture. |
| Pas de réponse | Le destinataire ne peut ni répondre, ni modifier, ni transférer la lettre depuis le site. |

## 3. Acteurs

| Acteur | Accès | Peut |
|---|---|---|
| **Administrateur** | Onglet « Comptes » ; tableau de bord Supabase pour les durées | Expéditeur qui gère aussi les comptes autorisés et leur rôle. |
| **Expéditeur** | `/`, connecté avec un compte Google autorisé | Choisir un type, remplir la lettre, voir l'aperçu, générer et partager le lien, suivre ses lettres. |
| **Destinataire** | `/l/<identifiant>`, sans compte | Ouvrir l'enveloppe, lire, déclencher l'effet visuel, refermer. |
| **Visiteur non autorisé** | `/` | Se connecter avec Google, puis se voir refuser l'accès. |

## 4. Parcours

### 4.1 Expéditeur

1. Ouvre `/` et voit l'écran « Écrire une lettre ».
2. Clique sur « Se connecter avec Google ».
3. Le serveur vérifie que son adresse figure dans la liste des comptes autorisés :
   - **non autorisée** : message « Le compte … n'est pas autorisé », déconnexion immédiate ;
   - **autorisée** : accès au formulaire.
4. Choisit le type de lettre ; la palette de la page et l'aperçu changent aussitôt.
5. Remplit les champs ; l'aperçu se met à jour à chaque frappe.
6. Clique sur « Générer le lien » ; la lettre est enregistrée et le lien court s'affiche.
7. Copie le lien ou l'envoie par WhatsApp ou Telegram.
8. Peut écrire une autre lettre ou se déconnecter.

### 4.1 bis Historique et comptes

L'espace connecté comporte trois onglets, gardés dans l'adresse (`#historique`, `#comptes`) :

| Onglet | Visible par | Contenu |
|---|---|---|
| Nouvelle lettre | Tous les expéditeurs | Formulaire et aperçu ; le brouillon est conservé en changeant d'onglet. |
| Historique | Tous les expéditeurs | Ses propres lettres, de la plus récente à la plus ancienne. |
| Comptes | Administrateurs | Liste des comptes autorisés, ajout, retrait, rôle administrateur. |

**Historique.** Chaque lettre affiche son type, son titre, son destinataire, son statut et ses dates,
avec un décompte par statut en tête de liste.

| Statut | Signification | Détail affiché | Actions |
|---|---|---|---|
| Envoyée | Lien jamais ouvert, encore valable | Date de création, fin de validité du lien | Copier le lien, Annuler (le lien cesse de fonctionner) |
| Ouverte | Lien ouvert au moins une fois | Date d'ouverture, puis « lisible jusqu'à … » ou « lien expiré » | Retirer de l'historique |
| Expirée | Jamais ouverte, délai dépassé | Date de création, « jamais ouverte » | Retirer de l'historique |

**Comptes.** Un administrateur ajoute une adresse (avec ou sans rôle administrateur), donne ou
retire ce rôle, ou retire un compte. Il ne peut ni se retirer, ni retirer son propre rôle, pour
qu'il reste toujours un administrateur. Les lettres d'un compte retiré restent lisibles jusqu'à
leur expiration.

### 4.2 Destinataire

1. Ouvre le lien `/l/<identifiant>`.
2. La première ouverture démarre le compte à rebours côté serveur.
3. L'enveloppe arrive à l'écran, aux couleurs du type de lettre.
4. Brise le sceau (bouton ou clic sur l'enveloppe) ; le marteau frappe, l'enveloppe s'ouvre,
   la lettre vient au premier plan et le texte s'écrit mot à mot.
5. Peut cliquer sur le bouton d'effet (braises, confettis ou cœurs) et refermer la lettre.
6. Après expiration, le lien affiche « Cette lettre n'est plus disponible ».

## 5. Types de lettre

### 5.1 Champs du formulaire

`*` = obligatoire.

| Champ | Invitation | Anniversaire | Crush |
|---|---|---|---|
| Destinataire | Destinataire * | Prénom * | Prénom ou surnom * |
| Âge | – | Âge (facultatif, 1 à 150) | – |
| Titre * (60 caractères max) | ✓ | ✓ | ✓ |
| Message * (1 500 caractères max, retours à la ligne conservés) | ✓ | ✓ | ✓ |
| Date et heure | Date et heure * | – | – |
| Lieu | Lieu * (120 caractères max) | – | – |
| Signature (60 caractères max) | Facultative | Facultative | Facultative ; vide = « Anonyme » |

Quand l'expéditeur change de type, le destinataire et la signature sont conservés ; le titre et le
message sont remplacés par ceux du nouveau type s'ils n'ont pas été personnalisés.

### 5.2 Présentation

| Élément | Invitation | Anniversaire | Crush |
|---|---|---|---|
| Ambiance | Noir, enveloppe blanche, doublure dorée, cire rouge sang | Bleu nuit, enveloppe orange, cire rouge vif | Bordeaux, enveloppe anthracite, cire rose |
| Accueil | « Message De la plus haute importance / Pour sa majesté » | « Une surprise t'attend / prête à être découverte » | « Une lettre t'attend / scellée, rien que pour toi » |
| Bouton du sceau | « Touchez le sceau royal » | « Briser le sceau » | « Briser le sceau » |
| Bouton d'effet | « Votre humble serviteur 📜 » | « Happy Birthday ! 🎉 » | « Je t'aime ♥ » |
| Effet | Braises | Confettis | Cœurs |

### 5.3 Contenu affiché dans la lettre

« Pour {destinataire} », titre, « {âge} ans ! » (Anniversaire), message, encadré « Quand / Où »
(Invitation, date au format français complet), signature précédée d'un tiret.

## 6. Règles de gestion

| Règle | Valeur par défaut | Modifiable |
|---|---|---|
| Durée de lecture après la 1re ouverture | 5 minutes | `sendletter.settings.read_window` |
| Durée de vie d'un lien jamais ouvert | 7 jours | `sendletter.settings.unopened_ttl` |
| Fréquence du nettoyage des lettres expirées | Toutes les 5 minutes | Tâche `pg_cron` `sendletter-purge` |
| Conservation de la trace d'une lettre dans l'historique | 90 jours après sa création | `sendletter.settings.history_ttl` |
| Taille maximale d'une lettre | 8 Ko | Contrainte de la table `letters` |

- Le compte à rebours démarre à la **première ouverture du lien**, pas à la création ; il ne peut
  pas être remis à zéro, même en rechargeant la page.
- Pendant la durée de lecture, le lien peut être rouvert ou rechargé.
- Une lettre déjà affichée n'est pas retirée de l'écran à l'expiration ; seules les ouvertures
  suivantes sont bloquées.
- Les aperçus de lien de WhatsApp ou Telegram ne déclenchent pas le compte à rebours (leurs robots
  n'exécutent pas l'application).
- À l'expiration, le contenu de la lettre est effacé (message, date, lieu, âge, signature) ; seuls
  le destinataire, le titre, le type et les dates restent pour l'historique, puis disparaissent
  après `history_ttl`.
- Lien expiré et lien inexistant affichent le même message.
- L'identifiant d'une lettre compte 10 caractères aléatoires, sans caractères ambigus (0, O, 1, l, i).

## 7. Sécurité

| Exigence | Mise en œuvre |
|---|---|
| Création réservée | `create_letter` exige une session et vérifie l'adresse dans `allowed_emails`, côté serveur. |
| Historique privé | `list_my_letters` et `delete_my_letter` ne portent que sur les lettres du compte connecté. |
| Gestion des comptes réservée | Les fonctions de gestion des comptes vérifient le rôle administrateur côté serveur. |
| Lecture sans compte | `open_letter` est la seule fonction accessible sans connexion. |
| Données inaccessibles directement | Schéma `sendletter` non exposé par l'API, RLS activée sans règle d'accès. |
| Isolation du projet partagé | Aucune modification des tables, règles ou fichiers de Slase Custom 3D. |
| Pas de modification d'une lettre | Aucune fonction de mise à jour : le contenu est figé à la création. |
| Secrets | Seules l'URL du projet et la clé publishable sont côté navigateur, via `.env.local` (non versionné). |

L'authentification est partagée avec Slase Custom 3D : un compte Google non autorisé peut se
connecter, mais ne peut rien faire dans sendLetter.

## 8. Architecture technique

| Couche | Choix |
|---|---|
| Interface | React 19, TypeScript, Vite |
| 3D et animations | Three.js (scène chargée en différé), GSAP, Web Animations API |
| Données et authentification | Supabase, projet « slase-custom-3d » (Paris), connexion Google OAuth |
| Hébergement | Vercel, avec réécriture de toutes les routes vers `index.html` |

### 8.1 Organisation du code

| Fichier | Rôle |
|---|---|
| `src/main.tsx` | Aiguillage : `/l/<id>` vers la lecture, le reste vers la configuration |
| `src/pages/ComposePage.tsx` | Connexion, contrôle des droits, onglets |
| `src/pages/compose/NewLetter.tsx` | Formulaire, aperçu, lien généré |
| `src/pages/compose/History.tsx` | Historique et statuts |
| `src/pages/compose/Accounts.tsx` | Gestion des comptes autorisés |
| `src/pages/ReadPage.tsx` | Chargement de la lettre, écrans « plus disponible » et erreur |
| `src/components/LetterExperience.tsx` | Enveloppe 3D, marteau, ouverture et fermeture |
| `src/components/Letter.tsx` | Lettre du destinataire et bouton d'effet |
| `src/components/LetterContent.tsx` | Contenu de la lettre, partagé avec l'aperçu |
| `src/components/ShareLinks.tsx` | Lien, copie, WhatsApp, Telegram |
| `src/lib/themes.ts` | Types de lettre : textes, palette, effet, champs |
| `src/lib/particles.ts` | Effets braises, confettis, cœurs |
| `src/lib/letters.ts` | Appels aux fonctions Supabase |
| `supabase/migrations/` | Schéma, fonctions et tâche de nettoyage |

### 8.2 Données

Schéma privé `sendletter` :

| Table | Colonnes |
|---|---|
| `letters` | `slug`, `sender_id`, `theme`, `fields` (JSON), `created_at`, `opened_at`, `purged_at` |
| `settings` | `read_window`, `unopened_ttl`, `history_ttl` (une seule ligne) |
| `allowed_emails` | `email`, `is_admin`, `added_at` |

Fonctions exposées :

| Fonction | Accès |
|---|---|
| `open_letter(slug)` | Tout le monde |
| `sender_info()`, `create_letter(theme, fields)`, `list_my_letters()`, `delete_my_letter(slug)` | Comptes autorisés |
| `list_allowed_emails()`, `add_allowed_email(email, admin)`, `remove_allowed_email(email)` | Administrateurs |

`can_send()` reste en place pour la compatibilité ; l'interface utilise `sender_info()`.

## 9. Exigences non fonctionnelles

- **Accessibilité** : navigation au clavier, focus visible, Échap pour refermer la lettre, texte
  complet lu par les lecteurs d'écran, annonces vocales des actions, respect de « réduire les
  animations ».
- **Responsive** : utilisable dès 360 px de large, sans défilement horizontal ; formulaire et
  aperçu empilés sous 860 px.
- **Performance** : le HTML s'affiche avant la scène 3D, chargée en différé ; qualité réduite sur
  les appareils modestes.
- **Repli** : enveloppe en CSS si WebGL est indisponible ou perdu.
- **Langue** : interface en français.

## 10. Déploiement

1. Variables d'environnement Vercel : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Supabase, Authentication > URL Configuration > Redirect URLs : `http://localhost:5173/**` et
   `https://<domaine-vercel>/**`.
3. Ajouter les expéditeurs depuis l'onglet « Comptes ».

## 11. Critères d'acceptation

- [ ] Un compte non autorisé est refusé et déconnecté après la connexion Google.
- [ ] Un compte autorisé crée une lettre de chacun des trois types.
- [ ] Les champs obligatoires bloquent l'envoi tant qu'ils sont vides.
- [ ] L'aperçu reflète le type et les champs saisis.
- [ ] Le lien généré ouvre la bonne lettre, aux couleurs de son type, sans connexion.
- [ ] Aucun bouton de réponse, d'édition ou de transfert n'apparaît côté destinataire.
- [ ] Le lien reste lisible pendant 5 minutes après sa première ouverture, puis affiche
      « Cette lettre n'est plus disponible ».
- [ ] Un lien jamais ouvert expire au bout de 7 jours.
- [ ] Modifier `settings` change les durées sans redéployer le site.
- [ ] Slase Custom 3D fonctionne comme avant.
- [ ] L'historique affiche les lettres du compte avec le bon statut : envoyée, ouverte, expirée.
- [ ] « Annuler » une lettre envoyée rend son lien inutilisable.
- [ ] L'historique d'un expéditeur ne montre pas les lettres des autres.
- [ ] Un administrateur ajoute et retire un compte, et donne ou retire le rôle administrateur.
- [ ] Un compte ajouté peut se connecter ; un compte retiré est refusé.
- [ ] L'onglet « Comptes » n'apparaît pas pour un expéditeur non administrateur.

## 12. Hors périmètre (version 1.1)

- Réponse du destinataire.
- Lettre programmée ou envoyée par e-mail depuis le site.
- Aperçu animé complet (enveloppe 3D) dans la configuration.
- Lien « Crée ta propre lettre » après la lecture.

## 13. Évolutions possibles

- Prévisualisation complète de l'animation avant l'envoi.
- Couleurs des rabats de l'enveloppe liées à la palette (aujourd'hui anthracite pour tous les types).
- Projet Supabase dédié si l'usage grandit.
