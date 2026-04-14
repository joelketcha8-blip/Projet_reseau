#!/bin/bash

# ============================================================
# Script pour initialiser et pousser le projet sur GitHub
# UTILISATION :
#   chmod +x git-push.sh
#   ./git-push.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🚀 Push Projet Ordonnance → GitHub       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}\n"

# Vérifier que git est installé
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Installation de Git...${NC}"
    sudo apt-get install -y git
fi

# Configurer l'identité Git si pas encore fait
if [ -z "$(git config --global user.email)" ]; then
    echo -e "${YELLOW}Configuration Git requise${NC}"
    read -p "Votre email GitHub: " GIT_EMAIL
    read -p "Votre nom: " GIT_NAME
    git config --global user.email "$GIT_EMAIL"
    git config --global user.name "$GIT_NAME"
fi

# Aller dans le dossier du projet
REPO_URL="https://github.com/joelketcha8-blip/Projet_reseau.git"

# Vérifier si on est déjà dans un repo git
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initialisation du dépôt Git local...${NC}"
    git init
    git remote add origin "$REPO_URL"
fi

# Créer le .gitignore global
cat > .gitignore << 'EOF'
# Dépendances
node_modules/
.npm

# Variables d'environnement (NE JAMAIS POUSSER)
.env
.env.local
.env.production
.env*.local

# Build Next.js
.next/
out/
build/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Docker volumes (données locales)
postgres_data/
redis_data/

# Coverage
coverage/
.nyc_output/
EOF

echo -e "${GREEN}✅ .gitignore créé${NC}"

# Ajouter tous les fichiers
git add .

# Créer le commit
COMMIT_MSG="feat: Phase 1-5 — Analyse, Modélisation, Infrastructure, Backend, Frontend

✅ Phase 1 : Document d'analyse complet (concepts réseau ↔ domaine médical)
✅ Phase 2 : Modélisation données + Architecture hexagonale DDD
✅ Phase 3 : Docker Compose (PostgreSQL+PostGIS, Kafka, Redis, MinIO)
✅ Phase 4 : Mock Backend Node.js/Express (Auth JWT+2FA, Ordonnances, Géoloc)
✅ Phase 5 : Frontend Next.js connecté + UI multi-thèmes + i18n FR/EN

Technologies : Next.js · Spring Boot 4.0 · PostgreSQL 18 · Kafka · PostGIS
Sécurité : OAuth2 · JWT · 2FA
"

git commit -m "$COMMIT_MSG"

echo -e "\n${YELLOW}Push vers GitHub...${NC}"
echo -e "${YELLOW}(Un mot de passe ou token GitHub vous sera demandé)${NC}\n"

git push -u origin main

echo -e "\n${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Projet poussé sur GitHub avec succès !   ║${NC}"
echo -e "${GREEN}║  🔗 $REPO_URL  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}\n"
