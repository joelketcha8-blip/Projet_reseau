// src/controllers/medicamentController.js

const { query } = require('../config/database');

// Lister tous les médicaments (avec recherche)
const listerMedicaments = async (req, res) => {
  try {
    const { recherche, categorie, page = 1, limite = 20 } = req.query;
    const offset = (page - 1) * limite;
    const params = [];
    const conditions = ['actif = true'];

    if (recherche) {
      params.push(`%${recherche}%`);
      conditions.push(`(nom ILIKE $${params.length} OR denomination_commune ILIKE $${params.length})`);
    }

    if (categorie) {
      params.push(categorie.toUpperCase());
      conditions.push(`categorie = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(`SELECT COUNT(*) FROM medicaments ${where}`, params);
    const result = await query(
      `SELECT id, nom, denomination_commune, forme, dosage_standard, categorie, ordonnance_requise, ordonnance_speciale
       FROM medicaments ${where}
       ORDER BY nom ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limite, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page), limite: parseInt(limite),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limite)
      }
    });
  } catch (error) {
    console.error('Erreur liste médicaments:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Détail d'un médicament
const getMedicament = async (req, res) => {
  try {
    const result = await query('SELECT * FROM medicaments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Médicament introuvable.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Ajouter un médicament (admin uniquement)
const ajouterMedicament = async (req, res) => {
  try {
    const { nom, denominationCommune, forme, dosageStandard, categorie, description, ordonnanceRequise, ordonnanceSpeciale } = req.body;

    const result = await query(
      `INSERT INTO medicaments (nom, denomination_commune, forme, dosage_standard, categorie, description, ordonnance_requise, ordonnance_speciale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nom, denominationCommune, forme, dosageStandard, categorie, description, ordonnanceRequise ?? true, ordonnanceSpeciale ?? false]
    );

    res.status(201).json({ success: true, message: 'Médicament ajouté.', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur ajout médicament:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = { listerMedicaments, getMedicament, ajouterMedicament };