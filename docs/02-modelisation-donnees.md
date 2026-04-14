# Modélisation des Données — Projet Ordonnance Numérique
## Phase 2 : Conception

---

## 1. DIAGRAMME DES ENTITÉS

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│ UTILISATEUR │         │   ORDONNANCE    │         │  MEDICAMENT │
│─────────────│         │─────────────────│         │─────────────│
│ id (UUID)   │         │ id (UUID)       │    ┌───→│ id (UUID)   │
│ email       │         │ code (unique)   │    │    │ nom         │
│ mot_passe   │         │ qr_code         │    │    │ denomination│
│ nom         │         │ date_creation   │    │    │ forme       │
│ prenom      │         │ date_expiration │    │    │ dosage      │
│ telephone   │         │ statut          │    │    │ categorie   │
│ role        │         │ signature       │    │    │ ordonnance  │
└──────┬──────┘         │                 │    │    │ _requise    │
       │                │ medecin_id ─────┼────┼─┐  └─────────────┘
       │                │ patient_id ─────┼──┐ │ │
       │                └────────┬────────┘  │ │ │
       │                         │           │ │ │
       ├──→ MEDECIN               │           │ │ │
       │    ├ numero_ordre        │           │ │ │
       │    ├ specialite          ↓           │ │ │
       │    └ localisation  LIGNE_MEDICAMENT  │ │ │
       │                    ├ ordonnance_id   │ │ │
       ├──→ PHARMACIEN       ├ medicament_id ─┘ │ │
       │    ├ numero_licence  ├ dosage           │ │
       │    └ pharmacie_id   ├ frequence         │ │
       │                     ├ quantite_prescrite│ │
       └──→ PATIENT           └ quantite_delivree│ │
            ├ date_naissance                     │ │
            ├ allergies         MEDECIN ←────────┘ │
            └ localisation      └ id (UUID) ←──────┘
```

---

## 2. STATUTS D'UNE ORDONNANCE

```
                    ┌──────────────┐
                    │   CRÉÉE      │
                    │  (par médecin)│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    ACTIVE    │◄──── Aucun médicament délivré
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │                         │
              ▼                         ▼
   ┌──────────────────┐        ┌──────────────┐
   │  PARTIELLEMENT   │        │   EXPIREE    │◄── Date dépassée
   │    UTILISEE      │        └──────────────┘
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │    TERMINEE      │◄── Tous les médicaments délivrés
   └──────────────────┘

   ┌──────────────────┐
   │    ANNULEE       │◄── Annulée par le médecin
   └──────────────────┘
```

---

## 3. FLUX COMPLET D'UNE ORDONNANCE

```
ÉTAPE 1 — Création
━━━━━━━━━━━━━━━━━━
Médecin → [Connexion 2FA] → [Formulaire ordonnance]
         → Sélection patient
         → Ajout médicaments (nom, dosage, fréquence, durée)
         → [Signer numériquement]
         → ORDONNANCE créée avec :
           • Code unique : ORD-2025-00001
           • QR Code généré
           • Statut : ACTIVE
           • Expiration : +3 mois

ÉTAPE 2 — Réception par le patient
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patient → Notification push reçue
        → Ouvre l'app → Voit son ordonnance
        → Peut afficher le QR Code

ÉTAPE 3 — Délivrance en pharmacie
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pharmacien → [Connexion] → [Scanner QR Code]
           → Système vérifie :
             ✓ Ordonnance authentique ?
             ✓ Ordonnance pas expirée ?
             ✓ Médicaments pas déjà tous délivrés ?
           → Pharmacien coche les médicaments à délivrer
           → [Valider la délivrance]
           → Statut mis à jour automatiquement
           → Médecin + Patient reçoivent une notification

ÉTAPE 4 — Clôture
━━━━━━━━━━━━━━━━━
Quand tous les médicaments sont délivrés :
→ Statut passe à TERMINEE
→ Ordonnance archivée
→ Historique conservé
```

---

## 4. LISTE COMPLÈTE DES ÉCRANS

### 👤 Écrans communs (tous les rôles)
| Écran | Description |
|---|---|
| Connexion | Email + Mot de passe |
| Double authentification (2FA) | Code SMS ou application |
| Profil | Voir et modifier son profil |
| Notifications | Centre de notifications |
| Paramètres | Langue, devise, thème |

### 🩺 Écrans Médecin
| Écran | Description |
|---|---|
| Tableau de bord | Résumé : ordonnances créées, utilisées, expirées |
| Liste des ordonnances | Toutes ses ordonnances avec filtres |
| Nouvelle ordonnance | Formulaire de création d'ordonnance |
| Détail ordonnance | Voir une ordonnance et son historique |
| Mes patients | Liste de ses patients |
| Fiche patient | Historique médical d'un patient |

### 💊 Écrans Pharmacien
| Écran | Description |
|---|---|
| Tableau de bord | Ordonnances traitées aujourd'hui |
| Scanner ordonnance | Scanner QR code ou saisir un code |
| Validation délivrance | Sélectionner les médicaments à délivrer |
| Historique | Délivrances effectuées |

### 🤒 Écrans Patient
| Écran | Description |
|---|---|
| Mes ordonnances | Liste de toutes ses ordonnances |
| Détail ordonnance | Voir l'ordonnance avec QR Code |
| Trouver une pharmacie | Carte des pharmacies proches |
| Mon historique | Médicaments délivrés dans le passé |

### 🔐 Écrans Admin
| Écran | Description |
|---|---|
| Tableau de bord global | Statistiques plateforme |
| Gestion utilisateurs | Valider/bloquer des comptes |
| Catalogue médicaments | Ajouter/modifier les médicaments |
| Gestion pharmacies | Ajouter/modifier les pharmacies |

---

## 5. STRUCTURE DES DONNÉES JSON (API)

### Créer une ordonnance (requête POST /api/ordonnances)
```json
{
  "patientId": "uuid-du-patient",
  "notesMedecin": "Prendre avec de l'eau, éviter l'alcool",
  "medicaments": [
    {
      "medicamentId": "uuid-du-medicament",
      "dosage": "500mg",
      "frequence": "3 fois par jour",
      "duree": "7 jours",
      "quantitePrescrite": 21,
      "instructions": "Prendre pendant les repas"
    }
  ]
}
```

### Réponse (ordonnance créée)
```json
{
  "id": "abc-123-...",
  "code": "ORD-2025-00042",
  "qrCode": "data:image/png;base64,...",
  "statut": "ACTIVE",
  "dateCreation": "2025-04-09T10:30:00",
  "dateExpiration": "2025-07-09T10:30:00",
  "medecin": {
    "id": "...",
    "nom": "Martin",
    "prenom": "Jean",
    "specialite": "Médecine générale",
    "numeroOrdre": "MED-001"
  },
  "patient": {
    "id": "...",
    "nom": "Dupont",
    "prenom": "Marie"
  },
  "medicaments": [
    {
      "medicament": { "nom": "Amoxicilline", "forme": "COMPRIME" },
      "dosage": "500mg",
      "frequence": "3 fois par jour",
      "duree": "7 jours",
      "quantitePrescrite": 21,
      "quantiteDelivree": 0
    }
  ]
}
```

---

*Document Phase 2 — 3GI 2025-2026 — Projet Ordonnance Numérique*