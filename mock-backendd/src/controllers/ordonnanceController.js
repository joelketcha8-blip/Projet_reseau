// src/controllers/ordonnanceController.js
// Toute la logique des ordonnances

const QRCode = require('qrcode');
const { query, getClient } = require('../config/database');

// -----------------------------------------------
// CRÉER UNE ORDONNANCE
// POST /api/ordonnances
// Accessible : MEDECIN uniquement
// -----------------------------------------------
const creerOrdonnance = async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN'); // Démarrer une transaction

    const { patientId, notesMedecin, medicaments } = req.body;

    // Récupérer l'id du médecin connecté
    const medecinResult = await client.query(
      'SELECT id FROM medecins WHERE utilisateur_id = $1',
      [req.utilisateur.id]
    );

    if (medecinResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Profil médecin introuvable. Votre compte n\'est peut-être pas encore validé.'
      });
    }

    const medecinId = medecinResult.rows[0].id;

    // Vérifier que le patient existe
    const patientResult = await client.query(
      'SELECT id FROM patients WHERE id = $1',
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    }

    // Date d'expiration = 3 mois par défaut
    const dateExpiration = new Date();
    dateExpiration.setMonth(dateExpiration.getMonth() + 3);

    // Créer l'ordonnance (le code est généré automatiquement par le trigger SQL)
    const ordonnanceResult = await client.query(
      `INSERT INTO ordonnances (code, date_expiration, notes_medecin, medecin_id, patient_id)
       VALUES ('', $1, $2, $3, $4)
       RETURNING id, code, date_creation, date_expiration, statut`,
      [dateExpiration, notesMedecin, medecinId, patientId]
    );

    const ordonnance = ordonnanceResult.rows[0];

    // Ajouter les lignes de médicaments
    for (const med of medicaments) {
      // Vérifier que le médicament existe
      const medResult = await client.query(
        'SELECT id, nom FROM medicaments WHERE id = $1 AND actif = true',
        [med.medicamentId]
      );

      if (medResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Médicament introuvable : ${med.medicamentId}`
        });
      }

      await client.query(
        `INSERT INTO lignes_medicament 
         (ordonnance_id, medicament_id, dosage, frequence, duree, quantite_prescrite, instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ordonnance.id, med.medicamentId, med.dosage, med.frequence,
         med.duree, med.quantitePrescrite, med.instructions]
      );
    }

    // Générer le QR Code
    const qrData = JSON.stringify({
      ordonnanceId: ordonnance.id,
      code: ordonnance.code,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/ordonnance/${ordonnance.code}`
    });

    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      width: 300
    });

    // Sauvegarder le QR Code
    await client.query(
      'UPDATE ordonnances SET qr_code = $1 WHERE id = $2',
      [qrCodeBase64, ordonnance.id]
    );

    await client.query('COMMIT'); // Valider la transaction

    // Récupérer l'ordonnance complète pour la réponse
    const ordonnanceComplete = await getOrdonnanceComplete(ordonnance.id);

    res.status(201).json({
      success: true,
      message: 'Ordonnance créée avec succès !',
      data: ordonnanceComplete
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création ordonnance:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'ordonnance' });
  } finally {
    client.release();
  }
};

// -----------------------------------------------
// OBTENIR UNE ORDONNANCE PAR CODE OU ID
// GET /api/ordonnances/:code
// Accessible : MEDECIN (les siennes), PATIENT (les siennes), PHARMACIEN (toutes)
// -----------------------------------------------
const getOrdonnance = async (req, res) => {
  try {
    const { code } = req.params;

    // Chercher par code ORD-2025-xxxxx ou par UUID
    const isUUID = /^[0-9a-f-]{36}$/.test(code);
    const colonne = isUUID ? 'id' : 'code';

    const result = await query(
      `SELECT id FROM ordonnances WHERE ${colonne} = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    }

    const ordonnance = await getOrdonnanceComplete(result.rows[0].id);

    // Contrôle d'accès
    const role = req.utilisateur.role;

    if (role === 'MEDECIN') {
      // Vérifier que c'est son ordonnance
      const medecinResult = await query(
        'SELECT id FROM medecins WHERE utilisateur_id = $1',
        [req.utilisateur.id]
      );
      if (medecinResult.rows.length > 0 && ordonnance.medecin.id !== medecinResult.rows[0].id) {
        return res.status(403).json({ success: false, message: 'Accès refusé : ce n\'est pas votre ordonnance.' });
      }
    }

    if (role === 'PATIENT') {
      // Vérifier que c'est son ordonnance
      const patientResult = await query(
        'SELECT id FROM patients WHERE utilisateur_id = $1',
        [req.utilisateur.id]
      );
      if (patientResult.rows.length > 0 && ordonnance.patient.id !== patientResult.rows[0].id) {
        return res.status(403).json({ success: false, message: 'Accès refusé : ce n\'est pas votre ordonnance.' });
      }
    }

    res.json({ success: true, data: ordonnance });

  } catch (error) {
    console.error('Erreur get ordonnance:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// MES ORDONNANCES (médecin ou patient connecté)
// GET /api/ordonnances
// -----------------------------------------------
const mesOrdonnances = async (req, res) => {
  try {
    const { statut, page = 1, limite = 10 } = req.query;
    const offset = (page - 1) * limite;
    const role = req.utilisateur.role;

    let whereClause = '';
    let params = [];

    if (role === 'MEDECIN') {
      const medecinResult = await query(
        'SELECT id FROM medecins WHERE utilisateur_id = $1',
        [req.utilisateur.id]
      );
      if (medecinResult.rows.length === 0) {
        return res.json({ success: true, data: [], total: 0 });
      }
      whereClause = 'WHERE o.medecin_id = $1';
      params = [medecinResult.rows[0].id];
    }

    if (role === 'PATIENT') {
      const patientResult = await query(
        'SELECT id FROM patients WHERE utilisateur_id = $1',
        [req.utilisateur.id]
      );
      if (patientResult.rows.length === 0) {
        return res.json({ success: true, data: [], total: 0 });
      }
      whereClause = 'WHERE o.patient_id = $1';
      params = [patientResult.rows[0].id];
    }

    if (statut) {
      whereClause += params.length > 0 ? ` AND o.statut = $${params.length + 1}` : `WHERE o.statut = $1`;
      params.push(statut.toUpperCase());
    }

    // Compter le total
    const countResult = await query(
      `SELECT COUNT(*) FROM ordonnances o ${whereClause}`,
      params
    );

    // Récupérer les ordonnances
    const result = await query(
      `SELECT o.id, o.code, o.date_creation, o.date_expiration, o.statut,
              u_med.nom as medecin_nom, u_med.prenom as medecin_prenom,
              u_pat.nom as patient_nom, u_pat.prenom as patient_prenom,
              (SELECT COUNT(*) FROM lignes_medicament WHERE ordonnance_id = o.id) as nb_medicaments
       FROM ordonnances o
       JOIN medecins m ON o.medecin_id = m.id
       JOIN utilisateurs u_med ON m.utilisateur_id = u_med.id
       JOIN patients p ON o.patient_id = p.id
       JOIN utilisateurs u_pat ON p.utilisateur_id = u_pat.id
       ${whereClause}
       ORDER BY o.date_creation DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limite, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limite: parseInt(limite),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limite)
      }
    });

  } catch (error) {
    console.error('Erreur mes ordonnances:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// DÉLIVRER UNE ORDONNANCE (pharmacien)
// POST /api/ordonnances/:code/delivrer
// Accessible : PHARMACIEN uniquement
// -----------------------------------------------
const delivrerOrdonnance = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { code } = req.params;
    const { medicamentsDelivres, notesPharmacien } = req.body;

    // Trouver l'ordonnance
    const ordResult = await client.query(
      'SELECT id, statut, date_expiration FROM ordonnances WHERE code = $1',
      [code]
    );

    if (ordResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
    }

    const ordonnance = ordResult.rows[0];

    // Vérifier que l'ordonnance est valide
    if (ordonnance.statut === 'TERMINEE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cette ordonnance a déjà été entièrement utilisée.' });
    }

    if (ordonnance.statut === 'EXPIREE' || new Date(ordonnance.date_expiration) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cette ordonnance est expirée.' });
    }

    if (ordonnance.statut === 'ANNULEE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cette ordonnance a été annulée.' });
    }

    // Récupérer le pharmacien
    const pharmResult = await client.query(
      'SELECT id, pharmacie_id FROM pharmaciens WHERE utilisateur_id = $1',
      [req.utilisateur.id]
    );

    if (pharmResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Profil pharmacien introuvable.' });
    }

    const pharmacien = pharmResult.rows[0];

    // Créer la délivrance
    const delivranceResult = await client.query(
      `INSERT INTO delivrances (ordonnance_id, pharmacien_id, pharmacie_id, notes_pharmacien)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [ordonnance.id, pharmacien.id, pharmacien.pharmacie_id, notesPharmacien]
    );

    const delivranceId = delivranceResult.rows[0].id;

    // Enregistrer chaque médicament délivré
    for (const item of medicamentsDelivres) {
      // Vérifier la ligne de médicament
      const ligneResult = await client.query(
        `SELECT id, quantite_prescrite, quantite_delivree
         FROM lignes_medicament
         WHERE id = $1 AND ordonnance_id = $2`,
        [item.ligneMedicamentId, ordonnance.id]
      );

      if (ligneResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Ligne de médicament introuvable : ${item.ligneMedicamentId}` });
      }

      const ligne = ligneResult.rows[0];
      const quantiteRestante = ligne.quantite_prescrite - ligne.quantite_delivree;

      if (item.quantiteDelivree > quantiteRestante) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Quantité délivrée (${item.quantiteDelivree}) supérieure à la quantité restante (${quantiteRestante}).`
        });
      }

      // Enregistrer la délivrance de ce médicament
      await client.query(
        `INSERT INTO lignes_delivrance (delivrance_id, ligne_medicament_id, quantite_delivree)
         VALUES ($1, $2, $3)`,
        [delivranceId, item.ligneMedicamentId, item.quantiteDelivree]
      );

      // Mettre à jour la quantité délivrée (déclenche le trigger de mise à jour du statut)
      await client.query(
        `UPDATE lignes_medicament 
         SET quantite_delivree = quantite_delivree + $1
         WHERE id = $2`,
        [item.quantiteDelivree, item.ligneMedicamentId]
      );
    }

    await client.query('COMMIT');

    // Récupérer l'ordonnance mise à jour
    const ordonnanceMiseAJour = await getOrdonnanceComplete(ordonnance.id);

    res.json({
      success: true,
      message: 'Délivrance enregistrée avec succès !',
      data: ordonnanceMiseAJour
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur délivrance:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la délivrance' });
  } finally {
    client.release();
  }
};

// -----------------------------------------------
// ANNULER UNE ORDONNANCE
// DELETE /api/ordonnances/:code
// Accessible : MEDECIN (seulement les siennes)
// -----------------------------------------------
const annulerOrdonnance = async (req, res) => {
  try {
    const { code } = req.params;

    const medecinResult = await query(
      'SELECT id FROM medecins WHERE utilisateur_id = $1',
      [req.utilisateur.id]
    );

    const result = await query(
      `UPDATE ordonnances SET statut = 'ANNULEE', updated_at = NOW()
       WHERE code = $1 AND medecin_id = $2 AND statut = 'ACTIVE'
       RETURNING id, code, statut`,
      [code, medecinResult.rows[0].id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ordonnance introuvable ou déjà utilisée/annulée.'
      });
    }

    res.json({
      success: true,
      message: 'Ordonnance annulée.',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur annulation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// -----------------------------------------------
// Fonction utilitaire : récupérer une ordonnance complète
// -----------------------------------------------
const getOrdonnanceComplete = async (ordonnanceId) => {
  const result = await query(
    `SELECT 
       o.id, o.code, o.qr_code, o.date_creation, o.date_expiration,
       o.statut, o.notes_medecin,
       json_build_object(
         'id', m.id,
         'nom', u_med.nom,
         'prenom', u_med.prenom,
         'specialite', m.specialite,
         'numeroOrdre', m.numero_ordre
       ) as medecin,
       json_build_object(
         'id', p.id,
         'nom', u_pat.nom,
         'prenom', u_pat.prenom,
         'dateNaissance', p.date_naissance
       ) as patient,
       COALESCE(
         json_agg(
           json_build_object(
             'id', lm.id,
             'medicament', json_build_object(
               'id', med.id,
               'nom', med.nom,
               'forme', med.forme
             ),
             'dosage', lm.dosage,
             'frequence', lm.frequence,
             'duree', lm.duree,
             'quantitePrescrite', lm.quantite_prescrite,
             'quantiteDelivree', lm.quantite_delivree,
             'instructions', lm.instructions
           )
         ) FILTER (WHERE lm.id IS NOT NULL),
         '[]'
       ) as medicaments
     FROM ordonnances o
     JOIN medecins m ON o.medecin_id = m.id
     JOIN utilisateurs u_med ON m.utilisateur_id = u_med.id
     JOIN patients p ON o.patient_id = p.id
     JOIN utilisateurs u_pat ON p.utilisateur_id = u_pat.id
     LEFT JOIN lignes_medicament lm ON lm.ordonnance_id = o.id
     LEFT JOIN medicaments med ON lm.medicament_id = med.id
     WHERE o.id = $1
     GROUP BY o.id, m.id, u_med.nom, u_med.prenom, m.specialite, m.numero_ordre,
              p.id, u_pat.nom, u_pat.prenom, p.date_naissance`,
    [ordonnanceId]
  );

  return result.rows[0];
};

module.exports = { creerOrdonnance, getOrdonnance, mesOrdonnances, delivrerOrdonnance, annulerOrdonnance };