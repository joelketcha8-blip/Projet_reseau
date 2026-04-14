// src/controllers/authController.js
// Gère l'inscription, la connexion, et le 2FA

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { query } = require('../config/database');

// -----------------------------------------------
// INSCRIPTION — Créer un nouveau compte
// POST /api/auth/inscription
// -----------------------------------------------
const inscription = async (req, res) => {
  try {
    const { email, motDePasse, nom, prenom, telephone, role } = req.body;

    // Vérifier que l'email n'existe pas déjà
    const existant = await query(
      'SELECT id FROM utilisateurs WHERE email = $1',
      [email]
    );
    if (existant.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé.'
      });
    }

    // Vérifier que le rôle existe
    const roleResult = await query(
      'SELECT id FROM roles WHERE nom = $1',
      [role || 'PATIENT']
    );
    if (roleResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Valeurs autorisées : PATIENT, MEDECIN, PHARMACIEN'
      });
    }

    // Chiffrer le mot de passe
    const motDePasseHash = await bcrypt.hash(motDePasse, 12);

    // Créer l'utilisateur
    const nouvelUtilisateur = await query(
      `INSERT INTO utilisateurs (email, mot_de_passe_hash, nom, prenom, telephone, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, nom, prenom, telephone`,
      [email, motDePasseHash, nom, prenom, telephone, roleResult.rows[0].id]
    );

    const utilisateur = nouvelUtilisateur.rows[0];

    // Si médecin ou pharmacien, créer le profil correspondant
    if (role === 'MEDECIN' && req.body.numeroOrdre) {
      await query(
        `INSERT INTO medecins (utilisateur_id, numero_ordre, specialite, adresse_cabinet)
         VALUES ($1, $2, $3, $4)`,
        [utilisateur.id, req.body.numeroOrdre, req.body.specialite || 'Médecine générale', req.body.adresseCabinet]
      );
    }

    if (role === 'PHARMACIEN' && req.body.numeroLicence) {
      await query(
        `INSERT INTO pharmaciens (utilisateur_id, numero_licence)
         VALUES ($1, $2)`,
        [utilisateur.id, req.body.numeroLicence]
      );
    }

    if (role === 'PATIENT' || !role) {
      await query(
        `INSERT INTO patients (utilisateur_id, numero_patient, date_naissance)
         VALUES ($1, $2, $3)`,
        [utilisateur.id, `PAT-${Date.now()}`, req.body.dateNaissance || null]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.',
      data: {
        id: utilisateur.id,
        email: utilisateur.email,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom
      }
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du compte' });
  }
};

// -----------------------------------------------
// CONNEXION — Se connecter
// POST /api/auth/connexion
// -----------------------------------------------
const connexion = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    // Chercher l'utilisateur avec son rôle
    const result = await query(
      `SELECT u.id, u.email, u.mot_de_passe_hash, u.nom, u.prenom, 
              u.actif, u.two_factor_active, u.two_factor_secret,
              r.nom as role
       FROM utilisateurs u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.'
      });
    }

    const utilisateur = result.rows[0];

    // Vérifier que le compte est actif
    if (!utilisateur.actif) {
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur.'
      });
    }

    // Vérifier le mot de passe
    const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe_hash);
    if (!motDePasseValide) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.'
      });
    }

    // Si 2FA activé, demander le code
    if (utilisateur.two_factor_active) {
      // Générer un token temporaire (valable 5 minutes) pour la 2ème étape
      const tokenTemporaire = jwt.sign(
        { userId: utilisateur.id, etape: '2FA_REQUIS' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        success: true,
        twoFactorRequis: true,
        tokenTemporaire,
        message: 'Entrez votre code 2FA pour continuer.'
      });
    }

    // Générer le token JWT final
    const token = genererToken(utilisateur);
    const tokenRefresh = genererTokenRefresh(utilisateur);

    res.json({
      success: true,
      message: `Bienvenue ${utilisateur.prenom} !`,
      data: {
        token,
        tokenRefresh,
        utilisateur: {
          id: utilisateur.id,
          email: utilisateur.email,
          nom: utilisateur.nom,
          prenom: utilisateur.prenom,
          role: utilisateur.role
        }
      }
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la connexion' });
  }
};

// -----------------------------------------------
// VÉRIFICATION 2FA
// POST /api/auth/verifier-2fa
// -----------------------------------------------
const verifier2FA = async (req, res) => {
  try {
    const { tokenTemporaire, code2FA } = req.body;

    // Vérifier le token temporaire
    let decoded;
    try {
      decoded = jwt.verify(tokenTemporaire, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Session expirée. Reconnectez-vous.' });
    }

    if (decoded.etape !== '2FA_REQUIS') {
      return res.status(400).json({ success: false, message: 'Token invalide pour la 2FA.' });
    }

    // Récupérer l'utilisateur et son secret 2FA
    const result = await query(
      `SELECT u.id, u.email, u.nom, u.prenom, u.two_factor_secret, r.nom as role
       FROM utilisateurs u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    const utilisateur = result.rows[0];

    // Vérifier le code 2FA
    const codeValide = speakeasy.totp.verify({
      secret: utilisateur.two_factor_secret,
      encoding: 'base32',
      token: code2FA,
      window: 2  // Tolérance de 2 intervalles de 30 secondes
    });

    if (!codeValide) {
      return res.status(401).json({ success: false, message: 'Code 2FA incorrect.' });
    }

    // Générer le vrai token
    const token = genererToken(utilisateur);
    const tokenRefresh = genererTokenRefresh(utilisateur);

    res.json({
      success: true,
      message: `Bienvenue ${utilisateur.prenom} !`,
      data: { token, tokenRefresh, utilisateur: { id: utilisateur.id, email: utilisateur.email, nom: utilisateur.nom, prenom: utilisateur.prenom, role: utilisateur.role } }
    });

  } catch (error) {
    console.error('Erreur 2FA:', error);
    res.status(500).json({ success: false, message: 'Erreur vérification 2FA' });
  }
};

// -----------------------------------------------
// ACTIVER LE 2FA
// POST /api/auth/activer-2fa
// -----------------------------------------------
const activer2FA = async (req, res) => {
  try {
    // Générer un secret 2FA
    const secret = speakeasy.generateSecret({
      name: `Ordonnance App (${req.utilisateur.email})`,
      length: 32
    });

    // Sauvegarder le secret (pas encore activé)
    await query(
      'UPDATE utilisateurs SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, req.utilisateur.id]
    );

    res.json({
      success: true,
      message: 'Scannez le QR code avec Google Authenticator ou Authy',
      data: {
        secret: secret.base32,
        qrCodeUrl: secret.otpauth_url,
        instructions: 'Utilisez une application comme Google Authenticator pour scanner ce code'
      }
    });
  } catch (error) {
    console.error('Erreur activation 2FA:', error);
    res.status(500).json({ success: false, message: 'Erreur activation 2FA' });
  }
};

// -----------------------------------------------
// CONFIRMER L'ACTIVATION DU 2FA
// POST /api/auth/confirmer-2fa
// -----------------------------------------------
const confirmer2FA = async (req, res) => {
  try {
    const { code } = req.body;

    const result = await query(
      'SELECT two_factor_secret FROM utilisateurs WHERE id = $1',
      [req.utilisateur.id]
    );

    const codeValide = speakeasy.totp.verify({
      secret: result.rows[0].two_factor_secret,
      encoding: 'base32',
      token: code
    });

    if (!codeValide) {
      return res.status(400).json({ success: false, message: 'Code incorrect. Réessayez.' });
    }

    await query(
      'UPDATE utilisateurs SET two_factor_active = true WHERE id = $1',
      [req.utilisateur.id]
    );

    res.json({ success: true, message: '2FA activé avec succès !' });
  } catch (error) {
    console.error('Erreur confirmation 2FA:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// -----------------------------------------------
// MON PROFIL
// GET /api/auth/moi
// -----------------------------------------------
const monProfil = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.nom, u.prenom, u.telephone, u.two_factor_active,
              u.created_at, r.nom as role
       FROM utilisateurs u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.utilisateur.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// -----------------------------------------------
// Fonctions utilitaires : générer les tokens
// -----------------------------------------------
const genererToken = (utilisateur) => {
  return jwt.sign(
    { userId: utilisateur.id, role: utilisateur.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const genererTokenRefresh = (utilisateur) => {
  return jwt.sign(
    { userId: utilisateur.id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

module.exports = { inscription, connexion, verifier2FA, activer2FA, confirmer2FA, monProfil };