#!/bin/bash

# ============================================================
# Script d'installation et de démarrage du projet
# Ordonnance Numérique — Ubuntu
# 
# UTILISATION :
#   chmod +x setup.sh
#   ./setup.sh
# ============================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sans couleur

print_step() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================================
# ÉTAPE 1 : Vérifier les prérequis
# ============================================================
print_step "Vérification des prérequis"

# Vérifier si on est sur Ubuntu
if ! command -v apt &> /dev/null; then
    print_error "Ce script est conçu pour Ubuntu/Debian"
    exit 1
fi

print_success "Système Ubuntu/Debian détecté"

# ============================================================
# ÉTAPE 2 : Installer Docker
# ============================================================
print_step "Installation de Docker"

if command -v docker &> /dev/null; then
    print_success "Docker déjà installé : $(docker --version)"
else
    echo "Installation de Docker..."
    sudo apt-get update -q
    sudo apt-get install -y -q ca-certificates curl gnupg
    
    # Clé GPG Docker officielle
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Dépôt Docker
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update -q
    sudo apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Ajouter l'utilisateur courant au groupe docker
    sudo usermod -aG docker $USER
    
    print_success "Docker installé avec succès"
    print_warning "Vous devrez peut-être vous déconnecter et reconnecter pour utiliser Docker sans sudo"
fi

# ============================================================
# ÉTAPE 3 : Installer Node.js 20
# ============================================================
print_step "Installation de Node.js 20"

if command -v node &> /dev/null && [[ $(node --version | cut -d'v' -f2 | cut -d'.' -f1) -ge 18 ]]; then
    print_success "Node.js déjà installé : $(node --version)"
else
    echo "Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installé : $(node --version)"
fi

# ============================================================
# ÉTAPE 4 : Installer Java 21
# ============================================================
print_step "Installation de Java 21"

if command -v java &> /dev/null && java -version 2>&1 | grep -q "21"; then
    print_success "Java 21 déjà installé"
else
    echo "Installation de Java 21..."
    sudo apt-get install -y openjdk-21-jdk
    
    # Configurer JAVA_HOME
    echo 'export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64' >> ~/.bashrc
    echo 'export PATH=$PATH:$JAVA_HOME/bin' >> ~/.bashrc
    source ~/.bashrc
    
    print_success "Java 21 installé : $(java -version 2>&1 | head -1)"
fi

# ============================================================
# ÉTAPE 5 : Lancer l'infrastructure avec Docker
# ============================================================
print_step "Démarrage de l'infrastructure (PostgreSQL, Redis, Kafka, MinIO...)"

# Vérifier que le fichier docker-compose existe
if [ ! -f "docker/docker-compose.yml" ]; then
    print_error "Fichier docker/docker-compose.yml introuvable !"
    print_error "Assurez-vous d'être dans le dossier racine du projet"
    exit 1
fi

# Arrêter les anciens conteneurs s'ils tournent
echo "Arrêt des anciens conteneurs..."
docker compose -f docker/docker-compose.yml down 2>/dev/null || true

# Lancer les nouveaux conteneurs
echo "Démarrage des conteneurs..."
docker compose -f docker/docker-compose.yml up -d postgres redis zookeeper kafka minio adminer redis-insights kafka-ui

# Attendre que PostgreSQL soit prêt
echo "Attente de PostgreSQL..."
until docker exec ordonnance_postgres pg_isready -U ordonnance_user -d ordonnance_db &>/dev/null; do
    echo "  PostgreSQL en cours de démarrage..."
    sleep 2
done
print_success "PostgreSQL prêt !"

# ============================================================
# ÉTAPE 6 : Installer les dépendances Node.js
# ============================================================
print_step "Installation des dépendances Node.js"

# Mock Backend
if [ -d "mock-backend" ]; then
    echo "Installation des dépendances du mock-backend..."
    cd mock-backend
    npm install --silent
    cd ..
    print_success "Mock-backend : dépendances installées"
fi

# Frontend Web
if [ -d "ordonnance-app" ]; then
    echo "Installation des dépendances du frontend..."
    cd ordonnance-app
    npm install --silent
    cd ..
    print_success "Frontend (ordonnance-app) : dépendances installées"
fi

# ============================================================
# ÉTAPE 7 : Résumé final
# ============================================================
print_step "Installation terminée ! 🎉"

echo -e "\n${GREEN}Pour démarrer le projet :${NC}\n"
echo -e "  ${YELLOW}Terminal 1${NC} — Mock Backend :"
echo -e "    cd mock-backend && npm run dev\n"
echo -e "  ${YELLOW}Terminal 2${NC} — Frontend Web :"
echo -e "    cd ordonnance-app && npm run dev\n"

echo -e "\n${GREEN}Services disponibles :${NC}\n"
echo -e "  🌐 Application Web         : ${BLUE}http://localhost:3000${NC}"
echo -e "  🔧 Mock Backend API        : ${BLUE}http://localhost:3001${NC}"
echo -e "  🗄️  Base de données (Adminer): ${BLUE}http://localhost:8081${NC}"
echo -e "  📦 Redis Insights          : ${BLUE}http://localhost:8001${NC}"
echo -e "  📨 Kafka UI                : ${BLUE}http://localhost:8082${NC}"
echo -e "  🗃️  MinIO Console           : ${BLUE}http://localhost:9001${NC}"

echo -e "\n${GREEN}Identifiants de test :${NC}"
echo -e "  Admin : admin@ordonnance.cm / Admin@1234"
echo -e "  MinIO : minioadmin / minioadmin"
echo -e "  PostgreSQL : ordonnance_user / ordonnance_pass\n"