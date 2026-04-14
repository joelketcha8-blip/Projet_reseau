# Guide de connexion Frontend ↔ Backend
## Ordonnance Numérique — 3GI 2025-2026

---

## 🗺️ Architecture de la connexion

```
┌─────────────────────────────────────────────────────┐
│                 FRONTEND (Next.js)                  │
│                                                     │
│  app/login/page.jsx                                 │
│       ↓ appelle                                     │
│  hooks/useAuth.js          hooks/useOrdonnances.js  │
│       ↓ utilise            hooks/useMedicaments.js  │
│  lib/api.js  ←─────────── hooks/usePharmacies.js    │
│       ↓ fetch()                                     │
│  context/AppContext.jsx (état global: user, theme…) │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP / JSON
                   ↓ http://localhost:3001/api
┌─────────────────────────────────────────────────────┐
│              MOCK BACKEND (Node.js/Express)         │
│                                                     │
│  /api/auth/connexion   → authController.js          │
│  /api/ordonnances      → ordonnanceController.js    │
│  /api/medicaments      → medicamentController.js    │
│  /api/pharmacies/proches → geoController.js         │
└──────────────────┬──────────────────────────────────┘
                   │ SQL
                   ↓
┌─────────────────────────────────────────────────────┐
│         PostgreSQL 18 + PostGIS (Docker)            │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Démarrer le projet en 4 étapes (Ubuntu)

### Étape 1 — Cloner et configurer
```bash
git clone https://github.com/joelketcha8-blip/Projet_reseau.git
cd Projet_reseau
```

### Étape 2 — Lancer l'infrastructure Docker
```bash
# Lance PostgreSQL, Redis, Kafka, MinIO
docker compose -f docker/docker-compose.yml up -d

# Vérifier que tout tourne
docker ps
```

### Étape 3 — Démarrer le Mock Backend
```bash
cd mock-backend

# Copier la config
cp .env.example .env

# Installer et lancer
npm install
npm run dev
# → API disponible sur http://localhost:3001
# → Tester : curl http://localhost:3001/api/health
```

### Étape 4 — Démarrer le Frontend
```bash
cd ../ordonnance-app

# Copier la config
cp .env.local.example .env.local

# Installer et lancer
npm install
npm run dev
# → Application sur http://localhost:3000
```

---

## 📁 Fichiers créés — Ce que chaque fichier fait

| Fichier | Rôle |
|---|---|
| `lib/api.js` | Client API centralisé — toutes les requêtes HTTP vers le backend |
| `context/AppContext.jsx` | État global : user, token, thème, langue, notifications |
| `hooks/useAuth.js` | Gestion connexion / déconnexion / 2FA |
| `hooks/useOrdonnances.js` | CRUD ordonnances avec cache offline |
| `hooks/useMedicaments.js` | Catalogue médicaments avec cache |
| `hooks/usePharmacies.js` | Géolocalisation GPS + pharmacies proches |
| `app/login/page.jsx` | Page de connexion avec 2FA |
| `app/dashboard/page.jsx` | Dashboard connecté à l'API |
| `app/ordonnances/nouvelle/page.jsx` | Formulaire création ordonnance |
| `app/layout.jsx` | Layout racine avec AppProvider |

---

## 🔌 Comment utiliser les hooks dans vos composants

### Exemple 1 — Afficher les ordonnances
```jsx
'use client';
import { useOrdonnances } from '@/hooks/useOrdonnances';

export default function MesOrdonnances() {
  const { ordonnances, loading, error } = useOrdonnances();

  if (loading) return <div>Chargement…</div>;
  if (error)   return <div>Erreur : {error}</div>;

  return (
    <ul>
      {ordonnances.map(ord => (
        <li key={ord.id}>{ord.code} — {ord.statut}</li>
      ))}
    </ul>
  );
}
```

### Exemple 2 — Créer une ordonnance
```jsx
const { creerOrdonnance, loading } = useOrdonnances();

const result = await creerOrdonnance({
  patientId: 'uuid-du-patient',
  notesMedecin: 'Prendre avec de l\'eau',
  medicaments: [{
    medicamentId: 'uuid-medicament',
    dosage: '500mg',
    frequence: '3 fois par jour',
    duree: '7 jours',
    quantitePrescrite: 21
  }]
});

if (result.success) console.log('Créée :', result.ordonnance.code);
```

### Exemple 3 — Chercher les pharmacies proches
```jsx
const { pharmacies, fetchProches, userPosition } = usePharmacies();

// Déclenche le GPS et charge les pharmacies dans un rayon de 3km
await fetchProches(3000);
```

### Exemple 4 — Récupérer l'état global
```jsx
const { user, theme, setTheme, lang, setLang, isOnline } = useApp();
```

---

## 🔒 Flux de sécurité complet

```
1. Utilisateur saisit email + mot de passe
2. POST /api/auth/connexion
   → Si 2FA activée : retourne tokenTemporaire
   → Sinon : retourne token JWT (24h)
3. Si 2FA : POST /api/auth/verifier-2fa avec code 6 chiffres
   → retourne token JWT
4. Token stocké dans localStorage
5. Toutes les requêtes suivantes : Authorization: Bearer <token>
6. Si token expiré (401) : redirection automatique vers /login
```

---

## 🧪 Tester la connexion avec curl

```bash
# 1. Se connecter
curl -X POST http://localhost:3001/api/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.martin@hopital.cm","motDePasse":"Test@1234"}'

# 2. Utiliser le token retourné
TOKEN="eyJhbGc..."

# 3. Lister les ordonnances
curl http://localhost:3001/api/ordonnances \
  -H "Authorization: Bearer $TOKEN"

# 4. Lister les médicaments (public)
curl http://localhost:3001/api/medicaments

# 5. Pharmacies proches de Yaoundé
curl "http://localhost:3001/api/pharmacies/proches?lat=3.848&lng=11.502&rayon=5000"
```

---

*3GI 2025-2026 — Projet Ordonnance Numérique*