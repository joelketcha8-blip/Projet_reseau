# 💊 Ordonnance Numérique — Projet Réseau 3GI 2025-2026

> Application de gestion numérique des ordonnances médicales  
> Cours : Réseaux — Semestre 2 | Groupe : [Votre groupe]

---

## 📖 Description

Cette application permet de **dématérialiser le processus d'ordonnance médicale** :
- Un **médecin** crée une ordonnance numérique sécurisée
- Le **patient** la reçoit sur son téléphone
- Le **pharmacien** la scanne pour délivrer les médicaments
- Tout se passe en **temps réel**, de manière **sécurisée** et **traçable**

### Lien avec les concepts réseau
| Réseau | Domaine médical |
|---|---|
| Émetteur | Médecin |
| Récepteur | Pharmacien |
| Message | Ordonnance |
| Protocole | Règles médicales et légales |
| TTL (Time To Live) | Date d'expiration de l'ordonnance |

---

## 🏗️ Architecture du projet

```
Projet_reseau/
├── ordonnance-app/          → Frontend Web (Next.js)
├── mobile-app/              → Application Mobile (React Native)
├── backend/                 → API Backend (Spring Boot 4.0 + Java 21)
├── mock-backend/            → Backend de développement (Node.js/Express)
├── docs/                    → Documentation du projet
│   ├── 01-analyse-domaine.md
│   ├── 02-modelisation-donnees.md
│   └── 03-maquettes/
├── docker/                  → Configuration Docker
│   └── docker-compose.yml
└── README.md
```

---

## 🛠️ Pile technologique

### Backend (Production)
- **Java 21** + **Spring Boot 4.0**
- **Spring Security** + OAuth 2.0 + JWT + 2FA
- **Apache Kafka** — Notifications temps réel
- **PostgreSQL 18** + **PostGIS** — Base de données géospatiale
- **Redis** — Cache et sessions
- **MinIO** — Stockage des fichiers (PDF ordonnances)
- **Liquibase** — Gestion des migrations de base de données
- **Swagger** — Documentation API

### Frontend Web
- **Next.js** (SSR + PWA)
- TypeScript
- Internationalisation (i18n) — Français / Anglais

### Mobile
- **React Native**
- Scan QR Code, GPS, Notifications push, Offline-First

### DevOps
- **Docker** + **Docker Compose**
- **GitLab** — Gestion du code source
- **Prometheus** — Monitoring

---

## 🚀 Lancer le projet en développement (Ubuntu)

### Prérequis
```bash
# Installer Docker et Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# Installer Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer Java 21
sudo apt install -y openjdk-21-jdk
```

### Démarrer tous les services avec Docker
```bash
# Cloner le projet
git clone https://github.com/joelketcha8-blip/Projet_reseau.git
cd Projet_reseau

# Lancer l'infrastructure (base de données, Kafka, Redis...)
docker compose -f docker/docker-compose.yml up -d

# Lancer le mock-backend (développement)
cd mock-backend
npm install
npm run dev

# Lancer le frontend web
cd ../ordonnance-app
npm install
npm run dev
```

### Accès aux services
| Service | URL |
|---|---|
| Application Web | http://localhost:3000 |
| Mock Backend API | http://localhost:3001 |
| Documentation API (Swagger) | http://localhost:8080/swagger-ui |
| Base de données (Adminer) | http://localhost:8081 |
| Redis Insights | http://localhost:8001 |
| MinIO Console | http://localhost:9001 |

---

## 👥 Répartition de l'équipe

| Membre | Rôle |
|---|---|
| Membre 1 | Chef de projet + Architecture + Docker |
| Membre 2 | Backend — Sécurité + Authentification |
| Membre 3 | Backend — Module Ordonnance + Kafka |
| Membre 4 | Backend — Module Patient + Pharmacien |
| Membre 5 | Frontend Web (Next.js) |
| Membre 6 | Frontend Mobile (React Native) |

---

## 📋 Avancement du projet

### Phase 1 — Analyse ✅
- [x] Document d'analyse du domaine
- [x] Identification des acteurs
- [x] Définition des règles métier
- [x] Lien formel réseau/métier

### Phase 2 — Modélisation 🔄
- [ ] Modèle de données complet
- [ ] Maquettes des écrans
- [ ] Architecture technique détaillée

### Phase 3 — Infrastructure ⏳
- [ ] Docker Compose complet
- [ ] Configuration GitLab CI/CD

### Phase 4 — Backend ⏳
- [ ] Authentification (OAuth2 + JWT + 2FA)
- [ ] Module Médecin
- [ ] Module Ordonnance
- [ ] Module Patient
- [ ] Module Pharmacien
- [ ] Notifications Kafka

### Phase 5 — Frontend ⏳
- [ ] Application Web (Next.js)
- [ ] Application Mobile (React Native)

### Phase 6 — Tests ⏳
- [ ] Tests unitaires
- [ ] Tests d'intégration

### Phase 7 — Déploiement ⏳
- [ ] Déploiement Docker
- [ ] Rapport final

---

## 📚 Documentation

- [01 — Analyse du domaine](./docs/01-analyse-domaine.md)
- [02 — Modélisation des données](./docs/02-modelisation-donnees.md)
- [03 — Maquettes](./docs/03-maquettes/)

---

*Projet réalisé dans le cadre du cours Réseaux — 3GI 2025-2026*