# sendLetter

Lettres scellées éphémères : l'expéditeur prépare une lettre (Invitation, Anniversaire ou Crush),
obtient un lien court, et le destinataire brise le sceau d'une enveloppe 3D pour la lire.

- `/` : configuration de la lettre, réservée aux comptes Google autorisés.
- `/l/<identifiant>` : lecture. Le lien n'est lisible que 5 minutes après sa première ouverture,
  et expire au bout de 7 jours s'il n'est jamais ouvert.

## Développement

```sh
cp .env.example .env.local   # puis renseigner l'URL et la clé publishable Supabase
npm install
npm run dev
```

## Supabase

Le projet utilise le projet Supabase « slase-custom-3d », partagé avec Slase Custom 3D.
Tout ce qui concerne les lettres vit dans le schéma privé `sendletter`
(migration : `supabase/migrations/20261029120000_sendletter.sql`).

Réglages modifiables depuis le tableau de bord (Table Editor, schéma `sendletter`) :

| Table | Rôle |
|---|---|
| `settings` | `read_window` (durée de lecture, 5 min), `unopened_ttl` (durée de vie sans ouverture, 7 jours), `history_ttl` (conservation dans l'historique, 90 jours) |
| `allowed_emails` | comptes Google autorisés et leur rôle ; gérés depuis l'onglet « Comptes » par les administrateurs |

Toutes les 5 minutes, la tâche `pg_cron` `sendletter-purge` efface le contenu des lettres expirées
(destinataire et titre restent pour l'historique), puis supprime celles qui dépassent `history_ttl`.

Dans Authentication > URL Configuration > Redirect URLs, ajouter :
- `http://localhost:5173/**`
- `https://<domaine-vercel>/**`

## Déploiement (Vercel)

Variables d'environnement : `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.
`vercel.json` renvoie toutes les routes vers `index.html` pour que les liens `/l/…` fonctionnent.
