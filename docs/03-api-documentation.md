# Documentation API — Ordonnance Numérique
## Base URL : `http://localhost:3001/api`

---

## 🔐 AUTHENTIFICATION

### 1. Créer un compte
**POST** `/auth/inscription`

**Corps de la requête :**
```json
{
  "email": "docteur.martin@exemple.cm",
  "motDePasse": "MotDePasse@123",
  "nom": "Martin",
  "prenom": "Jean",
  "telephone": "+237612345678",
  "role": "MEDECIN",
  "numeroOrdre": "MED-CM-001",
  "specialite": "Médecine générale",
  "adresseCabinet": "Avenue Kennedy, Yaoundé"
}
```
> Pour un patient : `"role": "PATIENT"`, pour un pharmacien : `"role": "PHARMACIEN"` avec `"numeroLicence": "PHARM-001"`

**Réponse succès (201) :**
```json
{
  "success": true,
  "message": "Compte créé avec succès !",
  "data": { "id": "uuid...", "email": "...", "nom": "...", "prenom": "..." }
}
```

---

### 2. Se connecter
**POST** `/auth/connexion`

```json
{ "email": "docteur.martin@exemple.cm", "motDePasse": "MotDePasse@123" }
```

**Réponse normale :**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "tokenRefresh": "eyJhbGciOiJIUzI1NiIs...",
    "utilisateur": { "id": "...", "nom": "Martin", "prenom": "Jean", "role": "MEDECIN" }
  }
}
```

**Si 2FA activé :**
```json
{ "success": true, "twoFactorRequis": true, "tokenTemporaire": "eyJ..." }
```

---

### 3. Vérifier le code 2FA
**POST** `/auth/verifier-2fa`

```json
{ "tokenTemporaire": "eyJ...", "code2FA": "123456" }
```

---

### 4. Mon profil
**GET** `/auth/moi`
> Header requis : `Authorization: Bearer <token>`

---

## 💊 ORDONNANCES

> ⚠️ Toutes ces routes nécessitent un token dans le header :
> `Authorization: Bearer <votre_token>`

---

### 5. Créer une ordonnance
**POST** `/ordonnances`
> Rôle requis : **MEDECIN**

```json
{
  "patientId": "uuid-du-patient",
  "notesMedecin": "Prendre avec beaucoup d'eau. Éviter l'alcool.",
  "medicaments": [
    {
      "medicamentId": "uuid-du-medicament",
      "dosage": "500mg",
      "frequence": "3 fois par jour",
      "duree": "7 jours",
      "quantitePrescrite": 21,
      "instructions": "Pendant les repas"
    },
    {
      "medicamentId": "uuid-autre-medicament",
      "dosage": "400mg",
      "frequence": "2 fois par jour",
      "duree": "5 jours",
      "quantitePrescrite": 10,
      "instructions": null
    }
  ]
}
```

**Réponse (201) :**
```json
{
  "success": true,
  "message": "Ordonnance créée avec succès !",
  "data": {
    "id": "uuid...",
    "code": "ORD-2025-00001",
    "qrCode": "data:image/png;base64,...",
    "statut": "ACTIVE",
    "dateCreation": "2025-04-09T10:30:00",
    "dateExpiration": "2025-07-09T10:30:00",
    "medecin": { "nom": "Martin", "prenom": "Jean", "specialite": "Médecine générale" },
    "patient": { "nom": "Dupont", "prenom": "Marie" },
    "medicaments": [ ... ]
  }
}
```

---

### 6. Voir une ordonnance
**GET** `/ordonnances/ORD-2025-00001`
> Rôles : MEDECIN (les siennes), PATIENT (les siennes), PHARMACIEN (toutes)

---

### 7. Mes ordonnances
**GET** `/ordonnances?statut=ACTIVE&page=1&limite=10`
> Rôles : MEDECIN, PATIENT

Paramètres optionnels :
- `statut` : ACTIVE, PARTIELLEMENT_UTILISEE, TERMINEE, EXPIREE, ANNULEE
- `page` : numéro de page (défaut: 1)
- `limite` : résultats par page (défaut: 10)

---

### 8. Délivrer des médicaments
**POST** `/ordonnances/ORD-2025-00001/delivrer`
> Rôle requis : **PHARMACIEN**

```json
{
  "notesPharmacien": "Patient informé des effets secondaires",
  "medicamentsDelivres": [
    {
      "ligneMedicamentId": "uuid-de-la-ligne",
      "quantiteDelivree": 21
    }
  ]
}
```

---

### 9. Annuler une ordonnance
**DELETE** `/ordonnances/ORD-2025-00001`
> Rôle requis : **MEDECIN** (seulement ses propres ordonnances actives)

---

## 💊 MÉDICAMENTS

### 10. Lister les médicaments
**GET** `/medicaments?recherche=paracetamol&categorie=ANALGESIQUE&page=1`
> Public — aucun token requis

---

### 11. Détail d'un médicament
**GET** `/medicaments/:id`

---

## 🏥 PHARMACIES ET GÉOLOCALISATION

### 12. Pharmacies proches de moi
**GET** `/pharmacies/proches?lat=3.8480&lng=11.5021&rayon=3000`
> `lat` et `lng` = coordonnées GPS | `rayon` = en mètres (défaut: 5000)

**Réponse :**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid...",
      "nom": "Pharmacie du Centre",
      "adresse": "Carrefour Nlongkak, Yaoundé",
      "distance_metres": 450.5,
      "latitude": 3.8501,
      "longitude": 11.5034,
      "telephone": "+237699887766"
    }
  ]
}
```

---

## 👤 PATIENTS

### 13. Mon profil patient
**GET** `/patients/moi`
> Rôle : PATIENT

### 14. Mes patients (médecin)
**GET** `/patients?recherche=dupont`
> Rôle : MEDECIN

### 15. Mettre à jour ma position
**PUT** `/patients/localisation`
> Rôle : PATIENT

```json
{ "latitude": 3.8480, "longitude": 11.5021 }
```

---

## 🚦 CODES DE RÉPONSE HTTP

| Code | Signification |
|---|---|
| 200 | Succès |
| 201 | Créé avec succès |
| 400 | Données invalides (erreur du client) |
| 401 | Non authentifié (token manquant ou expiré) |
| 403 | Non autorisé (rôle insuffisant) |
| 404 | Ressource introuvable |
| 500 | Erreur serveur |

---

## 🧪 TESTER L'API avec curl (Ubuntu)

```bash
# 1. Créer un médecin
curl -X POST http://localhost:3001/api/auth/inscription \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.test@test.cm","motDePasse":"Test@1234","nom":"Test","prenom":"Docteur","role":"MEDECIN","numeroOrdre":"MED-001","specialite":"Généraliste"}'

# 2. Se connecter et récupérer le token
curl -X POST http://localhost:3001/api/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.test@test.cm","motDePasse":"Test@1234"}'

# 3. Lister les médicaments (public)
curl http://localhost:3001/api/medicaments

# 4. Vérifier que l'API fonctionne
curl http://localhost:3001/api/health
```