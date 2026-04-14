# Document d'Analyse — Projet Ordonnance Numérique
## Cours : Réseaux — Semestre 2 | 3GI 2025-2026
### Groupe : [Nom du groupe]

---

## 1. DESCRIPTION DU DOMAINE

### 1.1 Qu'est-ce qu'une ordonnance médicale ?

Une ordonnance médicale est un document officiel rédigé par un médecin autorisé à l'intention d'un patient. Elle contient la liste des médicaments à prendre, les dosages, la durée du traitement, et les instructions de prise. Ce document est présenté en pharmacie pour obtenir les médicaments prescrits.

Dans le système de santé actuel, ce processus repose encore très largement sur du papier physique, ce qui engendre de nombreux problèmes : perte du document, falsification, double utilisation, et impossibilité de traçabilité en temps réel.

### 1.2 Les problèmes que notre application résout

| Problème réel | Solution apportée |
|---|---|
| Une ordonnance papier peut être perdue | L'ordonnance est stockée numériquement et accessible partout |
| Un patient peut falsifier une ordonnance | Chaque ordonnance est signée numériquement par le médecin |
| Une ordonnance peut être utilisée plusieurs fois | Le système marque automatiquement une ordonnance comme "utilisée" |
| Impossible de savoir si un médicament a déjà été retiré | Historique complet de chaque délivrance |
| Le médecin ne sait pas si son patient a récupéré ses médicaments | Notifications en temps réel au médecin |
| Pas de localisation des pharmacies disponibles | Géolocalisation des pharmacies intégrée |

---

## 2. MODÉLISATION RÉSEAU DU DOMAINE

> Le professeur demande d'établir un lien formel entre les concepts réseau et le domaine métier.

### 2.1 Tableau de correspondance Réseau ↔ Métier

| Concept Réseau | Définition réseau | Équivalent dans notre projet |
|---|---|---|
| **Émetteur (Source)** | Entité qui initie et envoie un message | **Le Médecin** — il crée et envoie l'ordonnance |
| **Récepteur (Destination)** | Entité qui reçoit et traite le message | **Le Pharmacien** — il reçoit et exécute l'ordonnance |
| **Message** | Données transmises sur le réseau | **L'Ordonnance** — contenu de l'échange |
| **Protocole** | Règles régissant l'échange | **Les règles médicales et légales** de l'ordonnance |
| **Canal de transmission** | Voie par laquelle le message transite | **L'application numérique** (Web/Mobile) |
| **Accusé de réception** | Confirmation de réception du message | **Validation de délivrance** par le pharmacien |
| **Adresse Source** | Identifiant de l'émetteur | **Numéro d'ordre du médecin** |
| **Adresse Destination** | Identifiant du récepteur | **Code pharmacie / identifiant pharmacien** |
| **Encapsulation** | Structure du paquet de données | **Format structuré de l'ordonnance** (JSON) |
| **Routage** | Chemin emprunté par le message | **Patient porteur de l'ordonnance** vers la pharmacie |
| **Authentification** | Vérification de l'identité de l'émetteur | **Signature numérique du médecin + OAuth2/JWT** |
| **Contrôle d'intégrité** | S'assurer que le message n'a pas été altéré | **Hash cryptographique de l'ordonnance** |
| **Timeout / Expiration** | Durée de validité d'une session | **Date d'expiration de l'ordonnance** |
| **Diffusion (Broadcast)** | Envoi à plusieurs destinataires | **Partage d'ordonnance à plusieurs pharmacies** |
| **Ressource réseau** | Bande passante, mémoire, CPU | **Médicaments, stock pharmacie, disponibilité médecin** |

### 2.2 Schéma du flux de communication

```
┌─────────────┐       Ordonnance (Message)       ┌──────────────────┐
│   MÉDECIN   │ ─────────────────────────────→   │   PHARMACIEN     │
│  (Émetteur) │                                   │   (Récepteur)    │
│             │ ←─────────────────────────────    │                  │
└─────────────┘    Accusé de délivrance (ACK)     └──────────────────┘
       ↕                                                   ↕
       ↕          ┌──────────────────┐                    ↕
       └──────────│     PATIENT      │────────────────────┘
                  │  (Intermédiaire) │
                  │  Porteur du      │
                  │  "message"       │
                  └──────────────────┘
                           ↕
                  ┌──────────────────┐
                  │   APPLICATION    │
                  │  (Canal réseau)  │
                  │  Web + Mobile    │
                  └──────────────────┘
```

---

## 3. LES ACTEURS DU SYSTÈME

### 3.1 Fournisseurs de Service (FdS)

#### 🩺 Le Médecin
- **Rôle réseau :** Émetteur principal
- **Description :** Professionnel de santé autorisé à prescrire des médicaments
- **Ce qu'il fournit :** Ordonnances médicales, diagnostics, prescriptions
- **Données le concernant :**
  - Numéro d'ordre médical (identifiant unique officiel)
  - Nom, prénom, spécialité médicale
  - Coordonnées du cabinet (avec géolocalisation)
  - Signature numérique

#### 💊 Le Pharmacien
- **Rôle réseau :** Récepteur principal / Fournisseur secondaire
- **Description :** Professionnel de santé qui délivre les médicaments sur ordonnance
- **Ce qu'il fournit :** Médicaments, conseils pharmaceutiques
- **Données le concernant :**
  - Numéro de licence pharmaceutique
  - Nom de la pharmacie, adresse (avec géolocalisation)
  - Horaires d'ouverture
  - Stock de médicaments disponibles

### 3.2 Consommateurs de Service (CdS)

#### 🤒 Le Patient
- **Rôle réseau :** Intermédiaire / Routeur humain
- **Description :** Personne malade qui reçoit les soins
- **Ce qu'il consomme :** Ordonnances médicales, médicaments
- **Données le concernant :**
  - Nom, prénom, date de naissance
  - Numéro de sécurité sociale / identifiant patient
  - Allergies connues
  - Antécédents médicaux
  - Localisation (pour trouver la pharmacie la plus proche)

### 3.3 Acteur d'administration

#### 🔐 L'Administrateur Système
- **Rôle :** Superviseur de la plateforme
- **Ce qu'il fait :** Gestion des comptes, validation des médecins et pharmaciens, gestion de la liste des médicaments

---

## 4. LES RÈGLES MÉTIER (LE "PROTOCOLE")

> En réseau, un protocole est un ensemble de règles que les participants doivent respecter pour communiquer. Dans notre domaine, ce sont les règles légales et médicales.

### 4.1 Règles de création d'une ordonnance

| Règle | Description |
|---|---|
| R01 | Seul un médecin inscrit et validé peut créer une ordonnance |
| R02 | Une ordonnance doit obligatoirement contenir : médecin, patient, date, au moins 1 médicament |
| R03 | La durée de validité standard d'une ordonnance est de **3 mois** |
| R04 | Certains médicaments (stupéfiants) ont une ordonnance spéciale valable **7 jours** |
| R05 | L'ordonnance doit être signée numériquement par le médecin |
| R06 | Chaque ordonnance reçoit un **identifiant unique** (UUID) et un **QR Code** |

### 4.2 Règles de délivrance en pharmacie

| Règle | Description |
|---|---|
| R07 | Seul un pharmacien inscrit peut valider une ordonnance |
| R08 | Le pharmacien doit vérifier que l'ordonnance n'est pas expirée avant délivrance |
| R09 | Le pharmacien doit vérifier que l'ordonnance n'a pas déjà été entièrement utilisée |
| R10 | Un médicament peut être délivré en plusieurs fois (délivrance partielle autorisée) |
| R11 | Chaque délivrance est enregistrée avec : date, quantité, pharmacien |
| R12 | Quand tous les médicaments sont délivrés, l'ordonnance passe au statut "Terminée" |

### 4.3 Règles de sécurité

| Règle | Description |
|---|---|
| R13 | Un patient ne peut pas modifier une ordonnance |
| R14 | Un médecin ne peut voir que ses propres ordonnances |
| R15 | Un pharmacien ne peut voir qu'une ordonnance s'il en a le code |
| R16 | Toute tentative de falsification déclenche une alerte |
| R17 | L'authentification à deux facteurs (2FA) est obligatoire pour les médecins et pharmaciens |

---

## 5. LES OBJETS MÉTIER (Business Objects)

### 5.1 L'Ordonnance (objet central)

```
Ordonnance {
  id              : UUID unique
  code            : Code lisible (ex: ORD-2025-00123)
  qrCode          : Image QR Code pour scan rapide
  dateCreation    : Date et heure de création
  dateExpiration  : Date limite d'utilisation
  statut          : [ACTIVE, PARTIELLEMENT_UTILISEE, TERMINEE, EXPIREE, ANNULEE]
  signatureNumerique : Hash cryptographique
  
  medecin         : référence → Médecin
  patient         : référence → Patient
  lignesMedicaments : liste → [LigneMedicament]
  historiquesDelivrance : liste → [Delivrance]
}
```

### 5.2 La Ligne de Médicament (détail de prescription)

```
LigneMedicament {
  medicament      : référence → Médicament
  dosage          : ex: "500mg"
  frequence       : ex: "3 fois par jour"
  duree           : ex: "7 jours"
  quantitePrescrite : ex: 21 comprimés
  quantiteDelivree  : ex: 10 comprimés (mis à jour à chaque délivrance)
  instructions    : ex: "Prendre avec de la nourriture"
}
```

### 5.3 Le Médicament

```
Medicament {
  id              : UUID
  nom             : ex: "Paracétamol"
  denomination    : DCI (Dénomination Commune Internationale)
  forme           : [COMPRIME, SIROP, INJECTABLE, POMMADE, ...]
  categorie       : [ANTIBIOTIQUE, ANALGESIQUE, ANTIHYPERTENSEUR, ...]
  ordonnanceRequise : boolean
  ordonnanceSpeciale : boolean (pour stupéfiants)
  description     : description du médicament
}
```

### 5.4 La Délivrance (historique)

```
Delivrance {
  id              : UUID
  date            : date et heure de délivrance
  pharmacien      : référence → Pharmacien
  pharmacie       : référence → Pharmacie
  medicamentsDelivres : liste des médicaments délivrés avec quantités
  notes           : remarques du pharmacien
}
```

---

## 6. LES SERVICES OFFERTS

### 6.1 Services du Médecin

| Service | Description |
|---|---|
| Créer une ordonnance | Rédiger une nouvelle ordonnance pour un patient |
| Annuler une ordonnance | Invalider une ordonnance créée par erreur |
| Voir l'historique | Consulter toutes les ordonnances qu'il a créées |
| Gérer ses patients | Ajouter, modifier, consulter les fiches patients |
| Recevoir des notifications | Savoir quand une ordonnance a été utilisée |

### 6.2 Services du Pharmacien

| Service | Description |
|---|---|
| Scanner une ordonnance | Lire le QR code ou saisir le code d'une ordonnance |
| Valider une délivrance | Enregistrer les médicaments remis au patient |
| Vérifier la validité | Contrôler qu'une ordonnance est authentique et active |
| Consulter le stock | Voir la disponibilité des médicaments |

### 6.3 Services du Patient

| Service | Description |
|---|---|
| Consulter ses ordonnances | Voir toutes ses ordonnances actives et passées |
| Partager une ordonnance | Envoyer le code/QR à un pharmacien |
| Localiser une pharmacie | Trouver la pharmacie la plus proche avec le médicament disponible |
| Recevoir des notifications | Alertes sur l'expiration des ordonnances |

---

## 7. LES RESSOURCES NÉCESSAIRES

> En réseau, les ressources sont tout ce qui est nécessaire pour établir une communication.

| Ressource | Type | Description |
|---|---|---|
| Médecin disponible | Humaine | Professionnel de santé actif sur la plateforme |
| Pharmacie ouverte | Physique | Établissement géolocalisé avec stock |
| Médicaments en stock | Matérielle | Disponibilité physique des médicaments |
| Numéro d'ordre médecin | Légale | Autorisation officielle de prescrire |
| Licence pharmacien | Légale | Autorisation officielle de délivrer |
| Connexion internet | Technique | Pour accès temps réel (mode offline pour consultation) |
| Serveur applicatif | Technique | Infrastructure cloud hébergeant l'application |
| Base de données | Technique | Stockage sécurisé des ordonnances |

---

## 8. CONTRAINTES TECHNIQUES APPLIQUÉES AU PROJET

| Contrainte du prof | Application dans notre projet |
|---|---|
| Géo-référencement natif | Localisation des médecins, pharmacies, patients via PostGIS |
| Real Time | Notifications instant (Kafka) quand une ordonnance est utilisée |
| Multi-Tenant | Plusieurs hôpitaux/cliniques peuvent utiliser la même plateforme |
| PWA First | L'application web fonctionne comme une app mobile |
| Offline-First | Un patient peut voir ses ordonnances sans internet |
| Sécurité OAuth2/JWT/2FA | Connexion sécurisée, double authentification pour médecins/pharmaciens |
| Internationalisation | Interface disponible en Français et Anglais |
| Multi-devises | Facturation en XAF (CFA), EUR, USD |

---

## 9. CONCLUSION — LIEN FORMEL RÉSEAU/MÉTIER

Le domaine de l'ordonnance médicale est une implémentation naturelle des concepts réseau :

- L'**ordonnance** est un **paquet de données** qui transporte de l'information médicale structurée
- Le **médecin** est la **source** qui encapsule ce paquet avec sa signature (en-tête)
- Le **patient** est le **routeur** qui transporte physiquement ce paquet vers sa destination
- Le **pharmacien** est la **destination** qui décode et exécute le contenu du paquet
- Les **règles médicales et légales** constituent le **protocole** qui régit tout l'échange
- L'**expiration de l'ordonnance** est analogue au **TTL (Time To Live)** d'un paquet réseau
- La **vérification d'authenticité** est analogue au **checksum** d'un paquet

Notre application numérique joue le rôle de l'**infrastructure réseau** : elle garantit que le bon message arrive à la bonne destination, de manière sécurisée, authentifiée et traçable.

---

*Document rédigé par le groupe — 3GI 2025-2026*
*Projet Ordonnance Numérique — Semestre 2*