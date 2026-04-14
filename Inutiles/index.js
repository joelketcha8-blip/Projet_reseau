// src/routes/index.js
// Point d'entrée de toutes les routes

const express = require('express');
const router = express.Router();

const { verifierToken, verifierRole } = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const ordonnanceCtrl = require('../controllers/ordonnanceController');
const medicamentCtrl = require('../controllers/medicamentController');
const geoCtrl = require('../controllers/geoController');

// ============================================================
// ROUTES PUBLIQUES (pas besoin d'être connecté)
// ============================================================

// Authentification
router.post('/auth/inscription', authCtrl.inscription);
router.post('/auth/connexion', authCtrl.connexion);
router.post('/auth/verifier-2fa', authCtrl.verifier2FA);

// Médicaments (lecture publique)
router.get('/medicaments', medicamentCtrl.listerMedicaments);
router.get('/medicaments/:id', medicamentCtrl.getMedicament);

// Pharmacies (lecture publique)
router.get('/pharmacies', geoCtrl.listerPharmacies);
router.get('/pharmacies/proches', geoCtrl.pharmaciesProches);

// ============================================================
// ROUTES PROTÉGÉES (connexion requise)
// ============================================================

// Profil de l'utilisateur connecté
router.get('/auth/moi', verifierToken, authCtrl.monProfil);
router.post('/auth/activer-2fa', verifierToken, authCtrl.activer2FA);
router.post('/auth/confirmer-2fa', verifierToken, authCtrl.confirmer2FA);

// -----------------------------------------------
// ROUTES MÉDECIN
// -----------------------------------------------

// Ordonnances : créer et gérer
router.post(
  '/ordonnances',
  verifierToken,
  verifierRole('MEDECIN'),
  ordonnanceCtrl.creerOrdonnance
);

router.delete(
  '/ordonnances/:code',
  verifierToken,
  verifierRole('MEDECIN'),
  ordonnanceCtrl.annulerOrdonnance
);

// Patients du médecin
router.get(
  '/patients',
  verifierToken,
  verifierRole('MEDECIN'),
  geoCtrl.mesPatients
);

// Ajouter un médicament au catalogue (admin/médecin)
router.post(
  '/medicaments',
  verifierToken,
  verifierRole('ADMIN', 'MEDECIN'),
  medicamentCtrl.ajouterMedicament
);

// -----------------------------------------------
// ROUTES PHARMACIEN
// -----------------------------------------------

// Délivrer des médicaments sur une ordonnance
router.post(
  '/ordonnances/:code/delivrer',
  verifierToken,
  verifierRole('PHARMACIEN'),
  ordonnanceCtrl.delivrerOrdonnance
);

// -----------------------------------------------
// ROUTES MÉDECIN + PATIENT + PHARMACIEN
// -----------------------------------------------

// Voir une ordonnance (accès contrôlé selon le rôle)
router.get(
  '/ordonnances/:code',
  verifierToken,
  verifierRole('MEDECIN', 'PATIENT', 'PHARMACIEN', 'ADMIN'),
  ordonnanceCtrl.getOrdonnance
);

// Mes ordonnances (médecin = ses créations, patient = ses ordonnances)
router.get(
  '/ordonnances',
  verifierToken,
  verifierRole('MEDECIN', 'PATIENT'),
  ordonnanceCtrl.mesOrdonnances
);

// -----------------------------------------------
// ROUTES PATIENT
// -----------------------------------------------

// Profil patient
router.get(
  '/patients/moi',
  verifierToken,
  verifierRole('PATIENT'),
  geoCtrl.monProfilPatient
);

// Mettre à jour sa localisation GPS
router.put(
  '/patients/localisation',
  verifierToken,
  verifierRole('PATIENT'),
  geoCtrl.mettreAJourLocalisation
);

// ============================================================
// ROUTE DE SANTÉ (vérifier que l'API fonctionne)
// ============================================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ API Ordonnance opérationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'OK',
      base_donnees: 'Vérifiez les logs'
    }
  });
});

module.exports = router;