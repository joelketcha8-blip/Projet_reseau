// src/index.js
// Point d'entrée du Mock Backend — Ordonnance Numérique

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARES GLOBAUX
// ============================================================

// Sécurité des en-têtes HTTP
app.use(helmet());

// Autoriser les requêtes depuis le frontend (CORS)
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:8081'  // Adminer
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser le JSON des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logs des requêtes (format coloré en développement)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ============================================================
// ROUTES DE L'API
// Toutes les routes commencent par /api
// ============================================================
app.use('/api', routes);

// ============================================================
// PAGE D'ACCUEIL (utile pour tester rapidement)
// ============================================================
app.get('/', (req, res) => {
  res.json({
    message: '💊 Bienvenue sur l\'API Ordonnance Numérique',
    version: '1.0.0',
    documentation: `http://localhost:${PORT}/api/health`,
    endpoints: {
      auth: '/api/auth/*',
      ordonnances: '/api/ordonnances/*',
      medicaments: '/api/medicaments',
      pharmacies: '/api/pharmacies/*',
      patients: '/api/patients/*'
    },
    exemples: {
      inscription: 'POST /api/auth/inscription',
      connexion: 'POST /api/auth/connexion',
      creerOrdonnance: 'POST /api/ordonnances (token médecin requis)',
      voirOrdonnance: 'GET /api/ordonnances/ORD-2025-00001 (token requis)',
      delivrer: 'POST /api/ordonnances/ORD-2025-00001/delivrer (token pharmacien)'
    }
  });
});

// ============================================================
// GESTION DES ERREURS 404
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
    conseil: 'Consultez la documentation sur http://localhost:' + PORT
  });
});

// ============================================================
// GESTION GLOBALE DES ERREURS
// ============================================================
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     💊 API Ordonnance Numérique démarrée     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  URL     : http://localhost:${PORT}              ║`);
  console.log(`║  Mode    : ${process.env.NODE_ENV || 'development'}                     ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Routes disponibles :                        ║');
  console.log('║  POST /api/auth/inscription                  ║');
  console.log('║  POST /api/auth/connexion                    ║');
  console.log('║  GET  /api/ordonnances                       ║');
  console.log('║  POST /api/ordonnances                       ║');
  console.log('║  GET  /api/medicaments                       ║');
  console.log('║  GET  /api/pharmacies/proches                ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});

module.exports = app;