const express = require("express");
const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { signToken } = require("../utils/jwt");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const { sendOtpEmail } = require("../services/email.service");

const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { envoyerOTP, envoyerResetMotDePasse } = require("../services/emailService");
const { getCache, setCache, delCache } = require("../config/cache");


function publicUser(user) {
  return {
    id: user.id, nom: user.nom, email: user.email, telephone: user.telephone,
    adresse: user.adresse, role: user.role, boutiqueId: user.boutiqueId, permissions: user.permissions,
    isEmailVerified: user.isEmailVerified, mustChangePassword: user.mustChangePassword,
  };
}

// Rate limiting pour les inscriptions (max 5 par heure par IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Trop de tentatives d'inscription depuis cette adresse IP. Veuillez réessayer dans une heure." }
});

// Middleware de limitation pour le renvoi d'OTP (max 3 par heure par email/tel)
const resendOtpLimiter = async (req, res, next) => {
  try {
    const identifier = (req.body.email || req.body.telephone || "").toLowerCase().trim();
    if (!identifier) return next();
    const redisKey = `otp_resend_count:${identifier}`;
    const count = (await getCache(redisKey)) || 0;
    if (count >= 3) {
      return res.status(429).json({ message: "Limite atteinte : maximum 3 renvois de code par heure. Veuillez patienter." });
    }
    await setCache(redisKey, Number(count) + 1, 3600);
    next();
  } catch (err) { next(); }
};

// Inscription client avec génération OTP à 6 chiffres
router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { nom, email, telephone, motDePasse } = req.body;
    const cleanNom = nom ? String(nom).trim() : "";
    const cleanPhone = telephone ? String(telephone).trim() : "";
    const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;

    if (!cleanNom || !cleanPhone || !motDePasse) {
      return res.status(400).json({ message: "Le nom, le numéro de téléphone et le mot de passe sont requis." });
    }

    const { Op } = require("sequelize");
    const whereCond = [{ telephone: cleanPhone }];
    if (cleanEmail) whereCond.push({ email: cleanEmail });

    const existUser = await User.findOne({ where: { [Op.or]: whereCond } });

    if (existUser) {
      if (existUser.isEmailVerified) {
        return res.status(409).json({ message: "Un compte vérifié existe déjà avec ce numéro de téléphone ou cet e-mail." });
      }
      
      // Si aucun email fourni, valider automatiquement le compte sans exiger d'OTP
      if (!cleanEmail) {
        existUser.nom = cleanNom;
        existUser.telephone = cleanPhone;
        existUser.motDePasseHash = await bcrypt.hash(motDePasse, 10);
        existUser.isEmailVerified = true;
        existUser.otpCode = null;
        existUser.otpExpiresAt = null;
        await existUser.save();

        const token = signToken({ id: existUser.id, role: existUser.role });
        return res.status(200).json({
          requireOtp: false,
          token,
          user: publicUser(existUser),
          message: "Connexion réussie ! Bienvenue sur Soilihitech."
        });
      }

      // Compte existant non vérifié avec email : envoi OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const motDePasseHash = await bcrypt.hash(motDePasse, 10);

      existUser.nom = cleanNom;
      existUser.email = cleanEmail;
      existUser.telephone = cleanPhone;
      existUser.motDePasseHash = motDePasseHash;
      existUser.otpCode = otpCode;
      existUser.otpExpiresAt = otpExpiresAt;
      await existUser.save();

      const primaryId = cleanEmail || cleanPhone;
      await setCache(`otp:${primaryId}`, otpCode, 600);
      if (cleanEmail && cleanPhone) await setCache(`otp:${cleanPhone}`, otpCode, 600);

      envoyerOTP(cleanEmail, otpCode, cleanNom).catch(err => console.error("⚠️ OTP email non envoyé:", err.message));

      const token = signToken({ id: existUser.id, role: existUser.role });

      return res.status(200).json({
        requireOtp: true,
        token,
        user: publicUser(existUser),
        email: existUser.email,
        telephone: existUser.telephone,
        message: "Code de vérification à 6 chiffres envoyé pour valider votre compte."
      });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, 10);

    // Si pas d'email fourni, le compte est validé immédiatement sans OTP
    if (!cleanEmail) {
      const user = await User.create({
        nom: cleanNom,
        email: null,
        telephone: cleanPhone,
        motDePasseHash,
        role: "client",
        otpCode: null,
        otpExpiresAt: null,
        isEmailVerified: true
      });

      const token = signToken({ id: user.id, role: user.role });
      return res.status(201).json({
        requireOtp: false,
        token,
        user: publicUser(user),
        telephone: user.telephone,
        message: "Compte créé avec succès ! Bienvenue sur Soilihitech."
      });
    }

    // Si email fourni, envoyer le code OTP classique
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      nom: cleanNom,
      email: cleanEmail,
      telephone: cleanPhone,
      motDePasseHash,
      role: "client",
      otpCode,
      otpExpiresAt,
      isEmailVerified: false
    });

    const primaryId = cleanEmail || cleanPhone;
    await setCache(`otp:${primaryId}`, otpCode, 600);
    if (cleanEmail && cleanPhone) await setCache(`otp:${cleanPhone}`, otpCode, 600);

    envoyerOTP(cleanEmail, otpCode, cleanNom).catch(err => console.error("⚠️ OTP email non envoyé:", err.message));

    const token = signToken({ id: user.id, role: user.role });

    res.status(201).json({
      requireOtp: true,
      token,
      user: publicUser(user),
      email: user.email,
      telephone: user.telephone,
      message: "Compte créé avec succès ! Un code de vérification à 6 chiffres a été envoyé par e-mail."
    });
  } catch (err) { next(err); }
});

// Vérification du code OTP à 6 chiffres
router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, telephone, otpCode } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;
    const cleanOtp = otpCode ? String(otpCode).trim() : null;

    if (!cleanOtp) {
      return res.status(400).json({ message: "Veuillez saisir le code OTP à 6 chiffres." });
    }

    const identifier = cleanEmail || cleanPhone;
    if (!identifier) {
      return res.status(400).json({ message: "Aucun identifiant fourni pour la vérification." });
    }

    // Vérifier le compteur d'échecs (max 5 tentatives)
    const attemptsKey = `otp_attempts:${identifier}`;
    const attempts = (await getCache(attemptsKey)) || 0;
    if (attempts >= 5) {
      return res.status(429).json({ message: "Trop de tentatives échouées. Compte temporairement bloqué pour 15 minutes." });
    }

    const { Op } = require("sequelize");
    const whereConditions = [];
    if (cleanEmail) whereConditions.push({ email: cleanEmail });
    if (cleanPhone) whereConditions.push({ telephone: cleanPhone });

    const user = await User.findOne({ where: { [Op.or]: whereConditions } });
    if (!user) {
      return res.status(404).json({ message: "Compte introuvable." });
    }

    // Comparaison avec Redis puis BDD
    const redisOtp = await getCache(`otp:${identifier}`);
    const isOtpValid = (redisOtp && String(redisOtp) === cleanOtp) || 
                       (user.otpCode === cleanOtp && user.otpExpiresAt && new Date(user.otpExpiresAt) > new Date());

    if (!isOtpValid) {
      const newAttempts = Number(attempts) + 1;
      await setCache(attemptsKey, newAttempts, 900); // 15 min lock
      const remaining = 5 - newAttempts;
      return res.status(400).json({ 
        message: remaining > 0 
          ? `Code OTP incorrect. Il vous reste ${remaining} tentative(s).` 
          : "Nombre maximum de tentatives atteint. Compte temporairement bloqué pour 15 minutes." 
      });
    }

    // Validation réussie
    user.isEmailVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    // Nettoyage des compteurs Redis
    await delCache(`otp:${identifier}`);
    if (cleanEmail) await delCache(`otp:${cleanEmail}`);
    if (cleanPhone) await delCache(`otp:${cleanPhone}`);
    await delCache(attemptsKey);

    try {
      const { broadcast } = require("../utils/broadcaster");
      broadcast("user_registered", { userId: user.id, role: user.role, boutiqueId: user.boutiqueId });
    } catch (e) {}

    const token = signToken({ id: user.id, role: user.role });
    res.json({ success: true, message: "Vérification réussie ! Vous êtes connecté.", token, user: publicUser(user) });
  } catch (err) { next(err); }
});

// Renvoi du code OTP par email / notification
router.post("/resend-otp", resendOtpLimiter, async (req, res, next) => {
  try {
    const { email, telephone } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;

    const { Op } = require("sequelize");
    const whereConditions = [];
    if (cleanEmail) whereConditions.push({ email: cleanEmail });
    if (cleanPhone) whereConditions.push({ telephone: cleanPhone });

    if (whereConditions.length === 0) {
      return res.status(400).json({ message: "Identifiant requis." });
    }

    const user = await User.findOne({ where: { [Op.or]: whereConditions } });
    if (!user) return res.status(404).json({ message: "Compte introuvable." });

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = newOtp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const primaryId = cleanEmail || cleanPhone;
    await setCache(`otp:${primaryId}`, newOtp, 600);
    if (cleanEmail && cleanPhone) await setCache(`otp:${cleanPhone}`, newOtp, 600);

    if (user.email) {
      envoyerOTP(user.email, newOtp, user.nom).catch(err => console.error("⚠️ Renvoi OTP email non envoyé:", err.message));
    }

    res.json({ message: "Un nouveau code OTP a été envoyé à votre e-mail." });
  } catch (err) { next(err); }
});

// Demande de réinitialisation de mot de passe (Envoi d'e-mail avec lien)
router.post("/forgot-password", async (req, res, next) => {

  try {
    const { email } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    if (!cleanEmail) {
      return res.status(400).json({ message: "Veuillez saisir votre adresse e-mail." });
    }

    const user = await User.findOne({ where: { email: cleanEmail } });
    if (!user) {
      // Pour des raisons de sécurité, on retourne un message générique sans exposer si l'email existe
      return res.json({ message: "Si cette adresse e-mail est associée à un compte, un lien de réinitialisation vous a été envoyé." });
    }

    // Génération d'un token aléatoire de 64 caractères
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Stockage dans Redis avec un TTL de 15 minutes (900s)
    await setCache(`reset_token:${resetToken}`, user.id, 900);

    const baseUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${baseUrl}/connexion?resetToken=${resetToken}`;

    envoyerResetMotDePasse(user.email, resetUrl, user.nom).catch(err => console.error("⚠️ Email reset non envoyé:", err.message));

    res.json({ message: "Un e-mail contenant le lien de réinitialisation de votre mot de passe vous a été envoyé !" });
  } catch (err) { next(err); }
});

// Validation et modification du mot de passe via token
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, nouveauMotDePasse } = req.body;
    const cleanToken = token ? String(token).trim() : null;
    const cleanPass = nouveauMotDePasse ? String(nouveauMotDePasse).trim() : null;

    if (!cleanToken || !cleanPass) {
      return res.status(400).json({ message: "Token invalide ou nouveau mot de passe manquant." });
    }

    if (cleanPass.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const userId = await getCache(`reset_token:${cleanToken}`);
    if (!userId) {
      return res.status(400).json({ message: "Le lien de réinitialisation est invalide ou a expiré (validité : 15 minutes)." });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    user.motDePasseHash = await bcrypt.hash(cleanPass, 10);
    user.mustChangePassword = false;
    await user.save();

    // Suppression du token Redis après utilisation unique
    await delCache(`reset_token:${cleanToken}`);

    res.json({ success: true, message: "Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter." });
  } catch (err) { next(err); }
});



// Connexion (par téléphone ou e-mail + mot de passe)
router.post("/login", async (req, res, next) => {
  try {
    const { identifiant, email, telephone, motDePasse } = req.body;
    const inputVal = (identifiant || email || telephone || "").trim();

    if (!inputVal || !motDePasse) {
      return res.status(400).json({ message: "Veuillez saisir votre numéro de téléphone ou email et votre mot de passe." });
    }

    const { Op, Sequelize } = require("sequelize");
    const cleanDigits = inputVal.replace(/[^0-9]/g, "");

    const phoneOr = [{ telephone: inputVal }];
    if (cleanDigits) {
      phoneOr.push({ telephone: { [Op.like]: `%${cleanDigits}` } });
      if (cleanDigits.length >= 7) {
        phoneOr.push({ telephone: { [Op.like]: `%${cleanDigits.slice(-7)}` } });
      }
      phoneOr.push(Sequelize.where(
        Sequelize.fn("REPLACE", Sequelize.fn("REPLACE", Sequelize.col("telephone"), " ", ""), "+", ""),
        cleanDigits
      ));
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          ...phoneOr,
          { email: inputVal.toLowerCase() }
        ]
      }
    });

    if (!user) return res.status(401).json({ message: "Identifiants ou mot de passe incorrects." });

    const ok = await bcrypt.compare(motDePasse, user.motDePasseHash);
    if (!ok) return res.status(401).json({ message: "Identifiants ou mot de passe incorrects." });
    if (user.statut === "suspendu") return res.status(403).json({ message: "Compte suspendu." });

    const token = signToken({ id: user.id, role: user.role });
    res.json({ token, user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Mettre à jour son profil (nom, email, téléphone, adresse, mot de passe)
router.put("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    const { nom, email, telephone, adresse, nouveauMotDePasse, ancienMotDePasse } = req.body;

    if (nom) user.nom = nom;
    if (email !== undefined) {
      const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      if (cleanEmail && cleanEmail !== user.email) {
        const existing = await User.findOne({ where: { email: cleanEmail } });
        if (existing && existing.id !== user.id) {
          return res.status(409).json({ message: "Cette adresse e-mail est déjà utilisée par un autre compte." });
        }
        user.email = cleanEmail;
      } else if (!cleanEmail) {
        user.email = null;
      }
    }
    if (telephone !== undefined) user.telephone = telephone;
    if (adresse !== undefined) user.adresse = adresse;

    if (nouveauMotDePasse && nouveauMotDePasse.trim()) {
      if (user.mustChangePassword) {
        // First login password change doesn't strictly require old password if provided or skipped
      } else if (ancienMotDePasse) {
        const ok = await bcrypt.compare(ancienMotDePasse, user.motDePasseHash);
        if (!ok) return res.status(400).json({ message: "L'ancien mot de passe est incorrect." });
      }
      user.motDePasseHash = await bcrypt.hash(nouveauMotDePasse.trim(), 10);
      user.mustChangePassword = false;
    }

    await user.save();
    res.json({ message: "Profil mis à jour avec succès", user: publicUser(user) });
  } catch (err) { next(err); }
});

module.exports = router;
