// src/middleware/auth.js
// Vérifie que l'utilisateur est bien connecté

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// -----------------------------------------------
// Middleware principal : vérifie le token JWT
// -----------------------------------------------
const verifierToken = async (req, res, next) => {
  try {
    // Récupérer le token dans le header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Accès refusé : aucun token fourni. Connectez-vous d\'abord.'
      });
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que l'utilisateur existe toujours en base
    const result = await query(
      'SELECT id, email, nom, prenom, actif FROM utilisateurs WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide : utilisateur introuvable'
      });
    }

    const utilisateur = result.rows[0];

    if (!utilisateur.actif) {
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur.'
      });
    }

    // Ajouter les infos de l'utilisateur à la requête
    req.utilisateur = {
      id: utilisateur.id,
      email: utilisateur.email,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré. Reconnectez-vous.'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide.'
      });
    }
    console.error('Erreur middleware auth:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// Middleware : vérifie le rôle de l'utilisateur
// Exemple : verifierRole('MEDECIN') ou verifierRole('MEDECIN', 'ADMIN')
// -----------------------------------------------
const verifierRole = (...rolesAutorises) => {
  return (req, res, next) => {
    if (!req.utilisateur) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!rolesAutorises.includes(req.utilisateur.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis : ${rolesAutorises.join(' ou ')}. Votre rôle : ${req.utilisateur.role}`
      });
    }

    next();
  };
};

module.exports = { verifierToken, verifierRole };