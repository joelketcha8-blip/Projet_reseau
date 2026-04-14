// src/controllers/geoController.js
// Gestion des patients et pharmacies avec géolocalisation

const { query } = require('../config/database');

// -----------------------------------------------
// PHARMACIES — Trouver les pharmacies proches (GPS)
// GET /api/pharmacies/proches?lat=3.86&lng=11.52&rayon=5000
// -----------------------------------------------
const pharmaciesProches = async (req, res) => {
  try {
    const { lat, lng, rayon = 5000 } = req.query; // rayon en mètres

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres lat et lng requis. Exemple: ?lat=3.86&lng=11.52'
      });
    }

    // Requête PostGIS : trouver les pharmacies dans un rayon donné
    const result = await query(
      `SELECT 
         id, nom, adresse, telephone, email, horaires_ouverture,
         ST_Distance(
           localisation::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
         ) as distance_metres,
         ST_X(localisation::geometry) as longitude,
         ST_Y(localisation::geometry) as latitude
       FROM pharmacies
       WHERE actif = true
         AND ST_DWithin(
           localisation::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3
         )
       ORDER BY distance_metres ASC
       LIMIT 20`,
      [parseFloat(lat), parseFloat(lng), parseInt(rayon)]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        coordonnees: { lat, lng },
        rayon_metres: parseInt(rayon),
        nombre_resultats: result.rows.length
      }
    });

  } catch (error) {
    console.error('Erreur pharmacies proches:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// PHARMACIES — Lister toutes les pharmacies
// GET /api/pharmacies
// -----------------------------------------------
const listerPharmacies = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nom, adresse, telephone, email, horaires_ouverture,
              ST_X(localisation::geometry) as longitude,
              ST_Y(localisation::geometry) as latitude
       FROM pharmacies WHERE actif = true ORDER BY nom`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// PATIENTS — Mes informations patient
// GET /api/patients/moi
// -----------------------------------------------
const monProfilPatient = async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.numero_patient, p.date_naissance, p.groupe_sanguin,
              p.allergies, p.antecedents_medicaux,
              u.nom, u.prenom, u.email, u.telephone,
              ST_X(p.localisation::geometry) as longitude,
              ST_Y(p.localisation::geometry) as latitude
       FROM patients p
       JOIN utilisateurs u ON p.utilisateur_id = u.id
       WHERE p.utilisateur_id = $1`,
      [req.utilisateur.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profil patient introuvable.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// PATIENTS — Mettre à jour la localisation
// PUT /api/patients/localisation
// -----------------------------------------------
const mettreAJourLocalisation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    await query(
      `UPDATE patients
       SET localisation = ST_SetSRID(ST_MakePoint($1, $2), 4326)
       WHERE utilisateur_id = $3`,
      [parseFloat(longitude), parseFloat(latitude), req.utilisateur.id]
    );

    res.json({ success: true, message: 'Localisation mise à jour.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// PATIENTS — Liste des patients d'un médecin
// GET /api/patients
// Accessible : MEDECIN uniquement
// -----------------------------------------------
const mesPatients = async (req, res) => {
  try {
    const { recherche } = req.query;

    // Récupérer les patients qui ont eu des ordonnances de ce médecin
    const medecinResult = await query(
      'SELECT id FROM medecins WHERE utilisateur_id = $1',
      [req.utilisateur.id]
    );

    if (medecinResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const medecinId = medecinResult.rows[0].id;
    const params = [medecinId];
    let rechercheClause = '';

    if (recherche) {
      params.push(`%${recherche}%`);
      rechercheClause = `AND (u.nom ILIKE $${params.length} OR u.prenom ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    const result = await query(
      `SELECT DISTINCT p.id, p.numero_patient, p.date_naissance, p.allergies,
              u.nom, u.prenom, u.email, u.telephone,
              COUNT(o.id) OVER (PARTITION BY p.id) as nb_ordonnances
       FROM patients p
       JOIN utilisateurs u ON p.utilisateur_id = u.id
       JOIN ordonnances o ON o.patient_id = p.id
       WHERE o.medecin_id = $1 ${rechercheClause}
       ORDER BY u.nom, u.prenom`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur mes patients:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { pharmaciesProches, listerPharmacies, monProfilPatient, mettreAJourLocalisation, mesPatients };