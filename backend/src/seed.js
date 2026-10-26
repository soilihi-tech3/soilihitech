const bcrypt = require("bcryptjs");
const { Boutique, User, Category, Product, Order, OrderItem, Review, Marque, Testimonial, Famille } = require("./models");

/**
 * Insère les données de démonstration Soilihitech dans soilihitechdb
 */
async function runSeed() {
  console.log("Initialisation des données Soilihitech (Accessoires Smartphones & Électronique)...");

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // --- 1. Super Admin plateforme ---
  await User.findOrCreate({
    where: { email: "superadmin@boutique-saas.com" },
    defaults: {
      nom: "Super Admin",
      email: "superadmin@boutique-saas.com",
      motDePasseHash: hash("SuperAdmin123!"),
      role: "super_admin",
    }
  });

  // --- 2. Bannières Slider Soilihitech (Accessoires Téléphones & High-Tech) ---
  const bannerSlides = [
    {
      id: 1,
      tag: "⚡ NOUVELLE COLLECTION ULTRA RAPIDE",
      title: "Chargeurs GaN & Câbles Renforcés",
      subtitle: "Rechargez votre iPhone, Samsung ou Tecno à 80% en 30 minutes avec nos blocs de charge intelligents 20W, 33W et 65W.",
      imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80",
      buttonText: "Voir les chargeurs",
      linkUrl: "/catalogue?famille=Chargeurs",
      editorial: "Soilihitech Power Tech",
      objectPosition: "center center"
    },
    {
      id: 2,
      tag: "🛡️ PROTECTION ULTIME 9D",
      title: "Glaces Trempées & Coques Antichoc",
      subtitle: "Verres antiespion haute résistance et coques transparentes antichoc renforcées pour iPhone, Samsung, Tecno, Infinix et Xiaomi.",
      imageUrl: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=1200&q=80",
      buttonText: "Protéger mon téléphone",
      linkUrl: "/catalogue?famille=Protections",
      editorial: "Protection Blindée",
      objectPosition: "center center"
    },
    {
      id: 3,
      tag: "🎵 EXPÉRIENCE AUDIO SANS FIL",
      title: "AirPods, Écouteurs & Powerbanks",
      subtitle: "Son immersif, réduction de bruit active et autonomie longue durée avec notre gamme audio Oraimo, Apple et JBL.",
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1200&q=80",
      buttonText: "Découvrir l'audio",
      linkUrl: "/catalogue?famille=Audio",
      editorial: "Pure Sound Edition",
      objectPosition: "center center"
    }
  ];

  // --- 3. Boutique Soilihitech ---
  let boutique = await Boutique.findOne({ where: { slug: "soilihitech" } });
  if (!boutique) {
    boutique = await Boutique.findOne({ where: { slug: "electro-pro" } });
  }

  if (!boutique) {
    boutique = await Boutique.create({
      nom: "Soilihitech",
      slug: "soilihitech",
      logoUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&q=80",
      couleurPrincipale: "#2563EB",
      devise: "KMF",
      formuleAbonnement: "commission",
      fraisLivraison: 1000,
      zonesLivraison: "Moroni, Grand Comore, Mitsamiouli, Foumbouni, Expédition îles",
      telephone: "+269 333 00 00",
      emailContact: "contact@soilihitech.com",
      aProposText: "Soilihitech est la boutique de référence pour tous vos accessoires pour smartphones et appareils électroniques. Que vous possédiez un iPhone, un Samsung, un Tecno, un Infinix ou un Xiaomi, nous vous garantissons les meilleurs chargeurs rapides, glaces de protection incassables, coques antichocs, écouteurs et batteries externes aux meilleurs prix.",
      bannerSlides: bannerSlides
    });
  }
  // Si la boutique existe déjà, on ne remplace pas ses bannières ni ses photos !

  // --- 4. Marques Référencées ---
  const marquesData = [
    { nom: "Apple (iPhone)", description: "Accessoires certifiés et compatibles iPhone, AirPods, iPad et chargeurs MagSafe." },
    { nom: "Samsung", description: "Accessoires haute compatibilité pour Galaxy Séries S, A, Z et chargeurs Super Fast." },
    { nom: "Tecno", description: "Pochettes antichoc, glaces et chargeurs officiels pour Tecno Spark, Camon et Pova." },
    { nom: "Infinix", description: "Protections écran, coques et chargeurs rapides pour Infinix Hot, Note et Smart." },
    { nom: "Xiaomi / Redmi", description: "Accessoires pour smartphones Redmi, Poco et Xiaomi avec charge turbo." },
    { nom: "Oraimo", description: "Écouteurs sans fil, chargeurs Anifast et câbles ultra-durables numéro 1 en Afrique." },
    { nom: "Anker", description: "Pionnier mondial de la charge rapide GaN et des batteries externes haute capacité." },
    { nom: "Baseus", description: "Design premium, supports voiture magnétiques et câbles tressés renforcés." },
    { nom: "JBL", description: "Expérience sonore légendaire avec casques et écouteurs immersifs." }
  ];

  const marquesMap = {};
  for (const m of marquesData) {
    let [mObj] = await Marque.findOrCreate({
      where: { nom: m.nom, boutiqueId: boutique.id },
      defaults: { ...m, boutiqueId: boutique.id }
    });
    marquesMap[m.nom] = mObj;
  }

  // --- 5. Comptes Administrateur, Employés & Client ---
  const usersToSeed = [
    { email: "superadmin@boutique-saas.com", nom: "Super Admin", role: "super_admin", pw: "SuperAdmin123!" },
    { email: "admin@soilihitech.com", nom: "Soilihi Abdou (Admin)", role: "admin", boutiqueId: boutique.id, pw: "Admin123!" },
    { email: "admin@electro-pro.com", nom: "Admin Backup", role: "admin", boutiqueId: boutique.id, pw: "Admin123!" },
    { email: "vendeur@soilihitech.com", nom: "Agent Vente Soilihitech", role: "employe", boutiqueId: boutique.id, pw: "Employe123!", permissions: ["voir_dashboard", "gerer_commandes"] },
    { email: "client@example.com", nom: "Client Fidèle", role: "client", pw: "Client123!" },
  ];

  for (const u of usersToSeed) {
    let usr = await User.findOne({ where: { email: u.email } });
    if (!usr) {
      await User.create({
        nom: u.nom,
        email: u.email,
        motDePasseHash: hash(u.pw),
        role: u.role,
        boutiqueId: u.boutiqueId || null,
        permissions: u.permissions || null
      });
    } else {
      usr.motDePasseHash = hash(u.pw);
      usr.role = u.role;
      if (u.boutiqueId) usr.boutiqueId = u.boutiqueId;
      if (u.permissions) usr.permissions = u.permissions;
      await usr.save();
    }
  }

  // --- 6. Familles & Catégories Soilihitech ---
  const familleList = [
    { nom: "Chargeurs & Blocs Rapides", boutiqueId: boutique.id },
    { nom: "Glaces & Protections Écran", boutiqueId: boutique.id },
    { nom: "Pochettes & Coques Antichoc", boutiqueId: boutique.id },
    { nom: "Écouteurs, Casques & Audio", boutiqueId: boutique.id },
    { nom: "Câbles & Connectique", boutiqueId: boutique.id },
    { nom: "Powerbanks & Batteries Externes", boutiqueId: boutique.id },
    { nom: "Supports Téléphone & Auto", boutiqueId: boutique.id }
  ];
  for (const fam of familleList) {
    await Famille.findOrCreate({
      where: { nom: fam.nom, boutiqueId: boutique.id },
      defaults: fam
    });
  }

  const catList = [
    { nom: "Blocs & Chargeurs Rapides", famille: "Chargeurs & Blocs Rapides", imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80" },
    { nom: "Glaces Trempées & Antiespion", famille: "Glaces & Protections Écran", imageUrl: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=400&q=80" },
    { nom: "Coques & Pochettes Silicone", famille: "Pochettes & Coques Antichoc", imageUrl: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=400&q=80" },
    { nom: "Écouteurs Sans Fil & AirPods", famille: "Écouteurs, Casques & Audio", imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80" },
    { nom: "Câbles USB-C & Lightning", famille: "Câbles & Connectique", imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80" },
    { nom: "Powerbanks Haute Capacité", famille: "Powerbanks & Batteries Externes", imageUrl: "https://images.unsplash.com/photo-1609592426508-410a4ec89f25?auto=format&fit=crop&w=400&q=80" },
    { nom: "Supports Voiture & Trépieds", famille: "Supports Téléphone & Auto", imageUrl: "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=400&q=80" }
  ];

  const cats = {};
  for (const c of catList) {
    const [catObj] = await Category.findOrCreate({
      where: { nom: c.nom, boutiqueId: boutique.id },
      defaults: { ...c, boutiqueId: boutique.id }
    });
    cats[c.nom] = catObj;
  }

  // --- 7. Produits Accessoires High-Tech pour Toutes Marques ---
  const produitsData = [
    // --- APPLE (iPhone) ---
    {
      nom: "Chargeur Rapide 20W USB-C iPhone (Certifié)",
      cat: "Blocs & Chargeurs Rapides",
      marque: "Apple (iPhone)",
      famille: "Chargeurs & Blocs Rapides",
      prix: 6500,
      prixPromo: 5500,
      enPromo: true,
      unite: "pièce",
      stock: 40,
      seuilAlerte: 5,
      coutAchat: 2800,
      ventesCount: 85,
      isNouveau: true,
      description: "Adaptateur secteur USB-C 20W offrant une recharge rapide et efficace à domicile ou au bureau. Recharge 50% de la batterie de votre iPhone en seulement 30 minutes. Protection anti-surchauffe intégrée.",
      imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1622445262464-84b14e0745b1?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Coque Transparente Antichoc MagSafe pour iPhone 15 / 16 Pro",
      cat: "Coques & Pochettes Silicone",
      marque: "Apple (iPhone)",
      famille: "Pochettes & Coques Antichoc",
      prix: 4500,
      prixPromo: 3800,
      enPromo: true,
      unite: "pièce",
      stock: 50,
      seuilAlerte: 8,
      coutAchat: 1800,
      ventesCount: 65,
      isNouveau: true,
      description: "Coque antichoc avec aimants intégrés parfaitement ajustés pour tous les accessoires MagSafe. Bords surélevés pour protéger l'écran et les lentilles photo. Ne jaunit pas dans le temps.",
      imageUrl: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1541877944-ac82a091518a?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Glace Trempée 9D Antiespion iPhone (Tous Modèles)",
      cat: "Glaces Trempées & Antiespion",
      marque: "Apple (iPhone)",
      famille: "Glaces & Protections Écran",
      prix: 2500,
      prixPromo: 2000,
      enPromo: true,
      unite: "pièce",
      stock: 75,
      seuilAlerte: 10,
      coutAchat: 800,
      ventesCount: 120,
      isNouveau: false,
      description: "Film de protection en verre trempé 9D haute confidentialité. Empêche les regards indiscrets sur les côtés tout en conservant une netteté cristalline et une sensibilité tactile parfaite.",
      imageUrl: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80"
    },

    // --- SAMSUNG ---
    {
      nom: "Chargeur Super Fast Charging 25W Type-C Samsung",
      cat: "Blocs & Chargeurs Rapides",
      marque: "Samsung",
      famille: "Chargeurs & Blocs Rapides",
      prix: 6000,
      prixPromo: 4900,
      enPromo: true,
      unite: "pièce",
      stock: 35,
      seuilAlerte: 5,
      coutAchat: 2600,
      ventesCount: 72,
      isNouveau: true,
      description: "Recharge ultra-rapide jusqu'à 25W pour les séries Galaxy S24, S23, A55, A35 et Note. Norme Power Delivery 3.0 avec régulation thermique intelligente.",
      imageUrl: "https://images.unsplash.com/photo-1622445262464-84b14e0745b1?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Pochette Cuir Flip Cover avec Porte-Cartes Samsung Galaxy",
      cat: "Coques & Pochettes Silicone",
      marque: "Samsung",
      famille: "Pochettes & Coques Antichoc",
      prix: 5000,
      prixPromo: 4200,
      enPromo: false,
      unite: "pièce",
      stock: 30,
      seuilAlerte: 5,
      coutAchat: 2100,
      ventesCount: 38,
      isNouveau: false,
      description: "Housse élégante en cuir synthétique avec fente pour cartes bancaires et fonction support vidéo. Fermeture magnétique sécurisée et protection intégrale à 360°.",
      imageUrl: "https://images.unsplash.com/photo-1541877944-ac82a091518a?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80"
    },

    // --- TECNO & INFINIX ---
    {
      nom: "Chargeur Ultra Rapide 33W Flash Charge Tecno & Infinix",
      cat: "Blocs & Chargeurs Rapides",
      marque: "Tecno",
      famille: "Chargeurs & Blocs Rapides",
      prix: 5500,
      prixPromo: 4500,
      enPromo: true,
      unite: "pièce",
      stock: 45,
      seuilAlerte: 6,
      coutAchat: 2200,
      ventesCount: 95,
      isNouveau: true,
      description: "Chargeur d'origine 33W Flash Charge spécialement conçu pour Tecno Camon, Spark, Pova et Infinix Note / Hot. Câble Type-C blindé haute intensité inclus.",
      imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Glace de Protection Céramique Incassable Tecno & Infinix",
      cat: "Glaces Trempées & Antiespion",
      marque: "Tecno",
      famille: "Glaces & Protections Écran",
      prix: 2000,
      prixPromo: 1500,
      enPromo: true,
      unite: "pièce",
      stock: 90,
      seuilAlerte: 15,
      coutAchat: 600,
      ventesCount: 150,
      isNouveau: true,
      description: "Film céramique incassable flexible nouvelle génération. Ne se fissure jamais lors des chocs quotidiens, résiste aux rayures et s'applique sans bulles.",
      imageUrl: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Coque Robuste Antichoc Béquille Intégrée pour Infinix",
      cat: "Coques & Pochettes Silicone",
      marque: "Infinix",
      famille: "Pochettes & Coques Antichoc",
      prix: 3500,
      prixPromo: 2900,
      enPromo: false,
      unite: "pièce",
      stock: 35,
      seuilAlerte: 5,
      coutAchat: 1400,
      ventesCount: 44,
      isNouveau: false,
      description: "Coque militaire renforcée avec anneau rotatif et béquille métallique pour poser votre téléphone à l'horizontale. Coins renforcés 'Air Cushion' contre les chutes.",
      imageUrl: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1541877944-ac82a091518a?auto=format&fit=crop&w=600&q=80"
    },

    // --- AUDIO & POWERBANKS (Oraimo, Anker, JBL) ---
    {
      nom: "Écouteurs Sans Fil Oraimo FreePods Pro (ANC & BassBoost)",
      cat: "Écouteurs Sans Fil & AirPods",
      marque: "Oraimo",
      famille: "Écouteurs, Casques & Audio",
      prix: 14000,
      prixPromo: 11900,
      enPromo: true,
      unite: "pièce",
      stock: 25,
      seuilAlerte: 4,
      coutAchat: 7500,
      ventesCount: 58,
      isNouveau: true,
      description: "Écouteurs sans fil avec réduction active du bruit (ANC) jusqu'à 35dB. Son haute fidélité avec basses profondes, autonomie totale de 32 heures avec boîtier de charge.",
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Powerbank Anker 20 000mAh PowerCore Charge Rapide",
      cat: "Powerbanks Haute Capacité",
      marque: "Anker",
      famille: "Powerbanks & Batteries Externes",
      prix: 18500,
      prixPromo: 16000,
      enPromo: true,
      unite: "pièce",
      stock: 20,
      seuilAlerte: 3,
      coutAchat: 11000,
      ventesCount: 34,
      isNouveau: true,
      description: "Batterie externe haute densité de 20 000 mAh permettant de recharger 5 à 6 fois votre smartphone. Double sortie USB-A et USB-C avec affichage LED du niveau d'énergie restant.",
      imageUrl: "https://images.unsplash.com/photo-1609592426508-410a4ec89f25?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Support Téléphone Voiture Magnétique Grille d'Aération Baseus",
      cat: "Supports Voiture & Trépieds",
      marque: "Baseus",
      famille: "Supports Téléphone & Auto",
      prix: 4500,
      prixPromo: 3500,
      enPromo: true,
      unite: "pièce",
      stock: 40,
      seuilAlerte: 5,
      coutAchat: 1700,
      ventesCount: 42,
      isNouveau: false,
      description: "Support pour voiture compact avec 6 aimants puissants garantissant une tenue parfaite même sur routes difficiles. Rotation 360° compatible avec tous les smartphones.",
      imageUrl: "https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Câble USB-C vers USB-C 100W Tressé Renforcé 2M Baseus",
      cat: "Câbles USB-C & Lightning",
      marque: "Baseus",
      famille: "Câbles & Connectique",
      prix: 3500,
      prixPromo: 2800,
      enPromo: true,
      unite: "pièce",
      stock: 60,
      seuilAlerte: 10,
      coutAchat: 1200,
      ventesCount: 88,
      isNouveau: true,
      description: "Câble de 2 mètres ultra résistant en nylon tressé supportant jusqu'à 100W de puissance (20V/5A). Idéal pour smartphones, tablettes et ordinateurs portables.",
      imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80"
    }
  ];

  // Insérer les produits seulement s'ils n'existent pas encore
  for (const p of produitsData) {
    const cat = cats[p.cat];
    const catId = cat ? cat.id : 1;
    const marqueObj = marquesMap[p.marque];
    const marqueId = marqueObj ? marqueObj.id : null;

    const prod = await Product.findOne({ where: { nom: p.nom, boutiqueId: boutique.id } });
    if (!prod) {
      await Product.create({
        boutiqueId: boutique.id,
        categoryId: catId,
        nom: p.nom,
        marqueId: marqueId,
        description: p.description,
        prix: p.prix,
        prixPromo: p.prixPromo || null,
        enPromo: p.enPromo || false,
        famille: p.famille || "Accessoires",
        poids: p.poids || null,
        unite: p.unite || "pièce",
        stock: p.stock || 20,
        seuilAlerte: p.seuilAlerte || 5,
        coutAchat: p.coutAchat || 0,
        ventesCount: p.ventesCount || 0,
        isNouveau: p.isNouveau || false,
        imageUrl: p.imageUrl,
        imageUrl2: p.imageUrl2 || null
      });
    }
    // Si le produit existe déjà, on NE le modifie pas pour préserver les photos, prix et descriptions de l'utilisateur !
  }

  // --- 8. Témoignages Clients Soilihitech ---
  const avisClients = [
    { nom: "Hakim M.", texte: "J'ai acheté la glace antiespion et le chargeur 20W pour mon iPhone 14 Pro. Livraison rapide à Moroni et produits 100% originaux !", note: 5, photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", ville: "Moroni" },
    { nom: "Anissa B.", texte: "La coque antichoc pour mon Tecno Camon est ultra solide. Très bon service client sur WhatsApp !", note: 5, photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", ville: "Mitsamiouli" },
    { nom: "Fahad S.", texte: "Les écouteurs Oraimo FreePods sont incroyables pour le prix, la réduction de bruit fonctionne super bien.", note: 5, photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80", ville: "Foumbouni" }
  ];

  for (const avis of avisClients) {
    await Testimonial.findOrCreate({
      where: { nom: avis.nom, boutiqueId: boutique.id },
      defaults: { ...avis, boutiqueId: boutique.id, actif: true }
    });
  }

  console.log("✅ Données Soilihitech initialisées avec succès dans la base de données !");
}

if (require.main === module) {
  const sequelize = require("./config/database");
  sequelize.sync({ alter: true }).then(() => {
    return runSeed();
  }).then(() => {
    console.log("Seed terminé.");
    process.exit(0);
  }).catch((err) => {
    console.error("Erreur durant le seed:", err);
    process.exit(1);
  });
}

module.exports = runSeed;
