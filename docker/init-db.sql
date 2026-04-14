-- ============================================================
-- Initialisation de la base de données Ordonnance Numérique
-- PostgreSQL + PostGIS
-- ============================================================

-- Activer l'extension géospatiale
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE : roles
-- Les différents rôles dans le système
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(50) NOT NULL UNIQUE,  -- MEDECIN, PHARMACIEN, PATIENT, ADMIN
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO roles (nom, description) VALUES
    ('ADMIN', 'Administrateur de la plateforme'),
    ('MEDECIN', 'Médecin autorisé à créer des ordonnances'),
    ('PHARMACIEN', 'Pharmacien autorisé à délivrer des médicaments'),
    ('PATIENT', 'Patient consommateur de soins')
ON CONFLICT (nom) DO NOTHING;

-- ============================================================
-- TABLE : utilisateurs
-- Tous les utilisateurs de la plateforme
-- ============================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    telephone VARCHAR(20),
    role_id UUID NOT NULL REFERENCES roles(id),
    actif BOOLEAN DEFAULT true,
    email_verifie BOOLEAN DEFAULT false,
    two_factor_active BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : medecins
-- Informations spécifiques aux médecins
-- ============================================================
CREATE TABLE IF NOT EXISTS medecins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    numero_ordre VARCHAR(50) NOT NULL UNIQUE,  -- Numéro d'ordre médical officiel
    specialite VARCHAR(100) NOT NULL,          -- Généraliste, Cardiologue, etc.
    adresse_cabinet TEXT,
    localisation GEOMETRY(POINT, 4326),        -- Coordonnées GPS du cabinet (PostGIS)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index géospatial pour les recherches par proximité
CREATE INDEX IF NOT EXISTS idx_medecins_localisation ON medecins USING GIST(localisation);

-- ============================================================
-- TABLE : pharmacies
-- Informations sur les pharmacies
-- ============================================================
CREATE TABLE IF NOT EXISTS pharmacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    adresse TEXT NOT NULL,
    localisation GEOMETRY(POINT, 4326),        -- Coordonnées GPS (PostGIS)
    telephone VARCHAR(20),
    email VARCHAR(255),
    horaires_ouverture JSONB,                  -- {"lundi": "8h-19h", "mardi": "8h-19h", ...}
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index géospatial
CREATE INDEX IF NOT EXISTS idx_pharmacies_localisation ON pharmacies USING GIST(localisation);

-- ============================================================
-- TABLE : pharmaciens
-- Informations spécifiques aux pharmaciens
-- ============================================================
CREATE TABLE IF NOT EXISTS pharmaciens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    numero_licence VARCHAR(50) NOT NULL UNIQUE,
    pharmacie_id UUID REFERENCES pharmacies(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : patients
-- Informations spécifiques aux patients
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    date_naissance DATE,
    numero_patient VARCHAR(50) UNIQUE,         -- Numéro de sécurité sociale ou équivalent
    groupe_sanguin VARCHAR(5),
    allergies TEXT[],                          -- Liste des allergies connues
    antecedents_medicaux TEXT,
    localisation GEOMETRY(POINT, 4326),        -- Dernière position connue
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : medicaments
-- Catalogue des médicaments disponibles
-- ============================================================
CREATE TABLE IF NOT EXISTS medicaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(255) NOT NULL,
    denomination_commune VARCHAR(255),          -- DCI (Dénomination Commune Internationale)
    forme VARCHAR(50),                          -- COMPRIME, SIROP, INJECTABLE, etc.
    dosage_standard VARCHAR(50),               -- ex: "500mg", "250mg/5ml"
    categorie VARCHAR(100),                    -- ANTIBIOTIQUE, ANALGESIQUE, etc.
    description TEXT,
    ordonnance_requise BOOLEAN DEFAULT true,
    ordonnance_speciale BOOLEAN DEFAULT false, -- Pour stupéfiants
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Quelques médicaments de test
INSERT INTO medicaments (nom, denomination_commune, forme, dosage_standard, categorie, ordonnance_requise) VALUES
    ('Doliprane', 'Paracétamol', 'COMPRIME', '1000mg', 'ANALGESIQUE', false),
    ('Amoxicilline', 'Amoxicilline', 'COMPRIME', '500mg', 'ANTIBIOTIQUE', true),
    ('Ibuprofène', 'Ibuprofène', 'COMPRIME', '400mg', 'ANTI_INFLAMMATOIRE', false),
    ('Metformine', 'Metformine', 'COMPRIME', '500mg', 'ANTIDIABETIQUE', true),
    ('Amlodipine', 'Amlodipine', 'COMPRIME', '5mg', 'ANTIHYPERTENSEUR', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE : ordonnances
-- La table centrale du système
-- ============================================================
CREATE TABLE IF NOT EXISTS ordonnances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,           -- Code lisible ex: ORD-2025-00001
    qr_code TEXT,                               -- Contenu du QR Code (base64 ou URL)
    date_creation TIMESTAMP DEFAULT NOW(),
    date_expiration TIMESTAMP NOT NULL,         -- 3 mois par défaut
    statut VARCHAR(30) DEFAULT 'ACTIVE',        -- ACTIVE, PARTIELLEMENT_UTILISEE, TERMINEE, EXPIREE, ANNULEE
    signature_numerique TEXT,                   -- Hash cryptographique pour authenticité
    notes_medecin TEXT,                         -- Instructions générales du médecin
    
    medecin_id UUID NOT NULL REFERENCES medecins(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT chk_statut CHECK (statut IN ('ACTIVE', 'PARTIELLEMENT_UTILISEE', 'TERMINEE', 'EXPIREE', 'ANNULEE'))
);

-- Index pour recherche rapide par code
CREATE INDEX IF NOT EXISTS idx_ordonnances_code ON ordonnances(code);
CREATE INDEX IF NOT EXISTS idx_ordonnances_statut ON ordonnances(statut);

-- ============================================================
-- TABLE : lignes_medicament
-- Détail des médicaments prescrits dans une ordonnance
-- ============================================================
CREATE TABLE IF NOT EXISTS lignes_medicament (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ordonnance_id UUID NOT NULL REFERENCES ordonnances(id) ON DELETE CASCADE,
    medicament_id UUID NOT NULL REFERENCES medicaments(id),
    dosage VARCHAR(50) NOT NULL,               -- ex: "500mg"
    frequence VARCHAR(100) NOT NULL,           -- ex: "3 fois par jour"
    duree VARCHAR(50),                         -- ex: "7 jours"
    quantite_prescrite INTEGER NOT NULL,       -- Quantité totale prescrite
    quantite_delivree INTEGER DEFAULT 0,       -- Quantité déjà délivrée (mise à jour)
    instructions TEXT,                         -- ex: "Prendre avec de la nourriture"
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : delivrances
-- Historique de chaque délivrance en pharmacie
-- ============================================================
CREATE TABLE IF NOT EXISTS delivrances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ordonnance_id UUID NOT NULL REFERENCES ordonnances(id),
    pharmacien_id UUID NOT NULL REFERENCES pharmaciens(id),
    pharmacie_id UUID NOT NULL REFERENCES pharmacies(id),
    date_delivrance TIMESTAMP DEFAULT NOW(),
    notes_pharmacien TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : lignes_delivrance
-- Détail de ce qui a été délivré lors d'une délivrance
-- ============================================================
CREATE TABLE IF NOT EXISTS lignes_delivrance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivrance_id UUID NOT NULL REFERENCES delivrances(id) ON DELETE CASCADE,
    ligne_medicament_id UUID NOT NULL REFERENCES lignes_medicament(id),
    quantite_delivree INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : notifications
-- Notifications temps réel envoyées via Kafka
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    destinataire_id UUID NOT NULL REFERENCES utilisateurs(id),
    type VARCHAR(50) NOT NULL,                 -- ORDONNANCE_CREEE, MEDICAMENTS_DELIVRES, ORDONNANCE_EXPIRE_BIENTOT
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    lu BOOLEAN DEFAULT false,
    donnees_supplementaires JSONB,             -- Données additionnelles (ex: id de l'ordonnance)
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- FONCTION : Génération automatique du code ordonnance
-- ============================================================
CREATE OR REPLACE FUNCTION generer_code_ordonnance()
RETURNS TRIGGER AS $$
DECLARE
    annee INTEGER;
    sequence INTEGER;
    nouveau_code VARCHAR(20);
BEGIN
    annee := EXTRACT(YEAR FROM NOW());
    SELECT COUNT(*) + 1 INTO sequence 
    FROM ordonnances 
    WHERE EXTRACT(YEAR FROM date_creation) = annee;
    
    nouveau_code := 'ORD-' || annee || '-' || LPAD(sequence::TEXT, 5, '0');
    NEW.code := nouveau_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer automatiquement le code
CREATE TRIGGER trigger_generer_code_ordonnance
    BEFORE INSERT ON ordonnances
    FOR EACH ROW
    WHEN (NEW.code IS NULL OR NEW.code = '')
    EXECUTE FUNCTION generer_code_ordonnance();

-- ============================================================
-- FONCTION : Mise à jour automatique du statut ordonnance
-- ============================================================
CREATE OR REPLACE FUNCTION mettre_a_jour_statut_ordonnance()
RETURNS TRIGGER AS $$
DECLARE
    total_prescrit INTEGER;
    total_delivre INTEGER;
BEGIN
    -- Calculer les totaux pour l'ordonnance
    SELECT 
        COALESCE(SUM(quantite_prescrite), 0),
        COALESCE(SUM(quantite_delivree), 0)
    INTO total_prescrit, total_delivre
    FROM lignes_medicament
    WHERE ordonnance_id = NEW.ordonnance_id;
    
    -- Mettre à jour le statut
    IF total_delivre = 0 THEN
        UPDATE ordonnances SET statut = 'ACTIVE', updated_at = NOW()
        WHERE id = NEW.ordonnance_id;
    ELSIF total_delivre < total_prescrit THEN
        UPDATE ordonnances SET statut = 'PARTIELLEMENT_UTILISEE', updated_at = NOW()
        WHERE id = NEW.ordonnance_id;
    ELSE
        UPDATE ordonnances SET statut = 'TERMINEE', updated_at = NOW()
        WHERE id = NEW.ordonnance_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger après chaque délivrance
CREATE TRIGGER trigger_statut_ordonnance
    AFTER INSERT OR UPDATE ON lignes_medicament
    FOR EACH ROW
    EXECUTE FUNCTION mettre_a_jour_statut_ordonnance();

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================

-- Utilisateur Admin
INSERT INTO utilisateurs (id, email, mot_de_passe_hash, nom, prenom, role_id, actif, email_verifie)
VALUES (
    uuid_generate_v4(),
    'admin@ordonnance.cm',
    crypt('Admin@1234', gen_salt('bf')),
    'Admin',
    'Système',
    (SELECT id FROM roles WHERE nom = 'ADMIN'),
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Message de confirmation
DO $$ BEGIN
    RAISE NOTICE '✅ Base de données initialisée avec succès !';
    RAISE NOTICE '📊 Tables créées : roles, utilisateurs, medecins, pharmacies, pharmaciens, patients, medicaments, ordonnances, lignes_medicament, delivrances, notifications';
    RAISE NOTICE '🔑 Admin : admin@ordonnance.cm / Admin@1234';
END $$;