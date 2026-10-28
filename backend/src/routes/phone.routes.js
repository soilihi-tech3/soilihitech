const express = require("express");
const { PhoneBrand, PhoneModel } = require("../models");
const { authenticate, requireRole, requireOwnBoutique } = require("../middleware/auth");
const { clearCachePattern } = require("../config/cache");

const router = express.Router();

function purgeCache() {
  clearCachePattern("/api/store").catch(() => {});
  clearCachePattern("store").catch(() => {});
}

router.use(authenticate, requireRole("admin", "employe"), requireOwnBoutique);

// GET /api/admin/phones - Liste complète des marques et de leurs sous-modèles
router.get("/", async (req, res, next) => {
  try {
    const brands = await PhoneBrand.findAll({
      where: { boutiqueId: req.boutiqueId },
      include: [
        {
          model: PhoneModel,
          as: "modeles",
          order: [["ordre", "ASC"], ["nom", "ASC"]]
        }
      ],
      order: [["ordre", "ASC"], ["nom", "ASC"]]
    });
    res.json(brands);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/phones/brands - Créer une marque de téléphone
router.post("/brands", async (req, res, next) => {
  try {
    const { nom, iconeUrl, ordre } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ message: "Le nom de la marque est requis." });
    }

    const brand = await PhoneBrand.create({
      boutiqueId: req.boutiqueId,
      nom: nom.trim(),
      iconeUrl: iconeUrl || null,
      ordre: Number(ordre) || 0
    });

    purgeCache();
    res.status(201).json(brand);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/phones/brands/:id - Modifier une marque
router.put("/brands/:id", async (req, res, next) => {
  try {
    const brand = await PhoneBrand.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });
    if (!brand) {
      return res.status(404).json({ message: "Marque introuvable." });
    }

    const { nom, iconeUrl, ordre } = req.body;
    if (nom !== undefined) brand.nom = nom.trim();
    if (iconeUrl !== undefined) brand.iconeUrl = iconeUrl;
    if (ordre !== undefined) brand.ordre = Number(ordre);

    await brand.save();
    purgeCache();
    res.json(brand);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/phones/brands/:id - Supprimer une marque et ses sous-modèles
router.delete("/brands/:id", async (req, res, next) => {
  try {
    const brand = await PhoneBrand.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });
    if (!brand) {
      return res.status(404).json({ message: "Marque introuvable." });
    }

    await PhoneModel.destroy({
      where: { brandId: brand.id, boutiqueId: req.boutiqueId }
    });
    await brand.destroy();

    purgeCache();
    res.json({ message: "Marque et sous-modèles supprimés avec succès." });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/phones/models - Ajouter un sous-modèle
router.post("/models", async (req, res, next) => {
  try {
    const { brandId, nom, nomComplet, ordre } = req.body;
    if (!brandId || !nom || !nom.trim()) {
      return res.status(400).json({ message: "La marque et le nom du modèle sont requis." });
    }

    const brand = await PhoneBrand.findOne({
      where: { id: brandId, boutiqueId: req.boutiqueId }
    });
    if (!brand) {
      return res.status(404).json({ message: "Marque associée introuvable." });
    }

    const fullNom = nomComplet && nomComplet.trim() ? nomComplet.trim() : `${brand.nom} ${nom.trim()}`;

    const model = await PhoneModel.create({
      boutiqueId: req.boutiqueId,
      brandId: brand.id,
      nom: nom.trim(),
      nomComplet: fullNom,
      ordre: Number(ordre) || 0
    });

    purgeCache();
    res.status(201).json(model);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/phones/models/batch - Ajouter plusieurs sous-modèles en lot (séparés par virgules ou retours à la ligne)
router.post("/models/batch", async (req, res, next) => {
  try {
    const { brandId, noms } = req.body;
    if (!brandId || !noms) {
      return res.status(400).json({ message: "Marque et liste de noms requises." });
    }

    const brand = await PhoneBrand.findOne({
      where: { id: brandId, boutiqueId: req.boutiqueId }
    });
    if (!brand) {
      return res.status(404).json({ message: "Marque associée introuvable." });
    }

    const nomsArray = (Array.isArray(noms) ? noms : noms.split(/[,\n]/))
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (nomsArray.length === 0) {
      return res.status(400).json({ message: "Aucun modèle valide trouvé." });
    }

    const createdModels = [];
    for (const nomItem of nomsArray) {
      const fullNom = nomItem.toLowerCase().startsWith(brand.nom.toLowerCase())
        ? nomItem
        : `${brand.nom} ${nomItem}`;

      const [model] = await PhoneModel.findOrCreate({
        where: {
          boutiqueId: req.boutiqueId,
          brandId: brand.id,
          nom: nomItem
        },
        defaults: {
          boutiqueId: req.boutiqueId,
          brandId: brand.id,
          nom: nomItem,
          nomComplet: fullNom,
          ordre: 0
        }
      });
      createdModels.push(model);
    }

    purgeCache();
    res.status(201).json({ message: `${createdModels.length} modèle(s) synchronisé(s).`, models: createdModels });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/phones/models/:id - Modifier un sous-modèle
router.put("/models/:id", async (req, res, next) => {
  try {
    const model = await PhoneModel.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });
    if (!model) {
      return res.status(404).json({ message: "Modèle introuvable." });
    }

    const { nom, nomComplet, ordre, brandId } = req.body;
    if (nom !== undefined) model.nom = nom.trim();
    if (nomComplet !== undefined) model.nomComplet = nomComplet.trim();
    if (ordre !== undefined) model.ordre = Number(ordre);
    if (brandId !== undefined) model.brandId = Number(brandId);

    await model.save();
    purgeCache();
    res.json(model);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/phones/models/:id - Supprimer un sous-modèle
router.delete("/models/:id", async (req, res, next) => {
  try {
    const model = await PhoneModel.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId }
    });
    if (!model) {
      return res.status(404).json({ message: "Modèle introuvable." });
    }

    await model.destroy();
    purgeCache();
    res.json({ message: "Modèle supprimé avec succès." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
