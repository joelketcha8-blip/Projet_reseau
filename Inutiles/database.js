// src/config/database.js
// Connexion à PostgreSQL

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'ordonnance_db',
  user: process.env.DB_USER || 'ordonnance_user',
  password: process.env.DB_PASSWORD || 'ordonnance_pass',
  max: 20,           // Maximum de connexions simultanées
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Tester la connexion au démarrage
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur connexion PostgreSQL :', err.message);
    console.error('   Vérifiez que Docker tourne : docker compose -f docker/docker-compose.yml up -d');
  } else {
    console.log('✅ Connecté à PostgreSQL');
    release();
  }
});

// Fonction utilitaire pour exécuter une requête
const query = (text, params) => pool.query(text, params);

// Fonction pour les transactions
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };