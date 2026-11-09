# 🚀 Guide Universel de Déploiement Multi-Applications sur Serveur VPS (Debian / Ubuntu)

Ce document est le **plan de déploiement officiel** pour héberger de nouvelles applications (Full Stack Node.js, React, MySQL, Redis, Nginx, SSL) sur votre serveur VPS.

Il est conçu pour être **réutilisable à l'infini**, que ce soit par vous-même ou directement exécuté par un **Agent IA**.

---

## 🏗️ 1. Architecture Multi-Applications sur le Serveur

Votre serveur VPS peut héberger **plusieurs dizaines d'applications en même temps** sans aucun conflit, grâce au routage par nom de domaine de Nginx :

```
                                  Serveur VPS (IP: 31.207.36.107)
                                 ┌──────────────────────────────────────────────┐
economestore.com ──► Port 80/443 │ Nginx ──► /var/www/economestore/frontend/dist │
                                 │       ──► Port 4000 (economestore-api)       │
                                 │                                              │
mon-autre-app.com ─► Port 80/443 │ Nginx ──► /var/www/autre-app/frontend/dist   │
                                 │       ──► Port 5000 (autre-app-api)          │
                                 │                                              │
                                 │ MariaDB : soilihitecdb, autre_app_db...      │
                                 │ Redis   : Port 6379 (partagé ultra-rapide)   │
                                 └──────────────────────────────────────────────┘
```

### Règles d'or pour éviter tout conflit entre applications :
1. **Dossier unique** : Chaque application dans `/var/www/<nom_du_projet>`
2. **Port Backend unique** :
   - Application 1 (`economestore`) : Port `4000`
   - Application 2 (`nouvelle_app`) : Port `5000`
   - Application 3 : Port `5001`, etc.
3. **Nom de processus PM2 unique** : `pm2 start src/server.js --name "<nom_du_projet>-api"`
4. **Base de données dédiée** : Une base MariaDB par projet (`<nom_du_projet>_db`).
5. **Configuration Nginx dédiée** : `/etc/nginx/sites-available/<nom_du_projet>.conf`.

---

## 📋 2. Procédure Étape par Étape pour Déployer une Nouvelle Application

### Étape 1 : Lier le Nom de Domaine (DNS chez LWS ou registrar)
1. Aller dans l'espace client (LWS Panel) ➔ **Domaine** ➔ **Zone DNS**.
2. Modifier la ligne de type **A** pour `@` :
   - Type : `A` | Nom : `@` | Valeur : `31.207.36.107` | TTL : `15 minutes`.
3. S'assurer que la ligne `www` (CNAME vers `@` ou type A) pointe également vers `31.207.36.107`.
4. Supprimer tout enregistrement de type **AAAA** (IPv6) pour éviter que les téléphones soient redirigés vers une page par défaut.

---

### Étape 2 : Créer la Base de Données MariaDB Dédiée
Se connecter au serveur en SSH :
```bash
ssh root@31.207.36.107
```
Créer la nouvelle base de données et donner les accès :
```bash
mariadb -e "CREATE DATABASE IF NOT EXISTS <nom_projet>_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; \
CREATE USER IF NOT EXISTS '<nom_projet>_user'@'localhost' IDENTIFIED BY 'MotDePasseSecurise2026@'; \
GRANT ALL PRIVILEGES ON <nom_projet>_db.* TO '<nom_projet>_user'@'localhost'; \
FLUSH PRIVILEGES;"
```

---

### Étape 3 : Télécharger le Code du Projet
Cloner le dépôt Git dans son propre sous-dossier :
```bash
mkdir -p /var/www/<nom_projet>
cd /var/www/<nom_projet>
git clone <URL_DU_DEPOT_GIT> .
```

---

### Étape 4 : Configurer et Démarrer le Backend (Node.js + PM2)
1. Aller dans le dossier backend :
   ```bash
   cd /var/www/<nom_projet>/backend
   ```
2. Créer le fichier `.env` avec le port dédié et la base de données :
   ```bash
   cat << 'EOF' > .env
   PORT=5000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=<nom_projet>_db
   DB_USER=<nom_projet>_user
   DB_PASSWORD=MotDePasseSecurise2026@
   DB_SSL=false
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   JWT_SECRET=CleSecreteTresLongueEtAleatoire123456789
   CORS_ORIGIN=*
   EOF
   ```
3. Installer les dépendances et démarrer avec PM2 :
   ```bash
   mkdir -p uploads
   npm install --production
   pm2 start src/server.js --name "<nom_projet>-api"
   pm2 save
   ```

---

### Étape 5 : Compiler le Frontend (React / Vite)
1. Aller dans le dossier frontend :
   ```bash
   cd /var/www/<nom_projet>/frontend
   ```
2. Créer le fichier d'environnement pour pointer vers `/api` en relatif :
   ```bash
   echo "VITE_API_URL=/api" > .env.production
   ```
3. Installer et compiler :
   ```bash
   npm install
   npm run build
   ```
*(Le dossier compilé `/var/www/<nom_projet>/frontend/dist` est généré).*

---

### Étape 6 : Configurer Nginx (Virtual Host Dédié)
1. Créer le fichier de configuration Nginx :
   ```bash
   cat << 'EOF' > /etc/nginx/sites-available/<nom_domaine>.conf
   server {
       listen 80;
       server_name <nom_domaine>.com www.<nom_domaine>.com;

       client_max_body_size 50M;

       # Frontend statique React
       root /var/www/<nom_projet>/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Backend API (redirige vers le bon port PM2, ex: 5000)
       location /api/ {
           proxy_pass http://127.0.0.1:5000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
           proxy_read_timeout 86400s;
       }

       # Uploads statiques
       location /uploads/ {
           alias /var/www/<nom_projet>/backend/uploads/;
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }
   }
   EOF
   ```
2. Activer le site et recharger Nginx :
   ```bash
   ln -sf /etc/nginx/sites-available/<nom_domaine>.conf /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```

---

### Étape 7 : Activer le Certificat SSL HTTPS Gratuit (Certbot)
En une seule commande, Certbot active le HTTPS et la redirection automatique :
```bash
certbot --nginx -d <nom_domaine>.com -d www.<nom_domaine>.com
```

---

## 🔄 3. Comment Mettre à Jour une Application (Quand vous faites des modifications)

Quand vous modifiez le code et faites un `git push` sur GitHub, pour mettre à jour le serveur :

```bash
cd /var/www/<nom_projet> && \
git pull && \
cd backend && npm install --production && pm2 restart <nom_projet>-api && \
cd ../frontend && npm install && npm run build && \
echo "=== APPLICATION MISE A JOUR AVEC SUCCES ==="
```

---

## 🤖 4. Prompt Clé en Main à donner à un Agent IA

Vous pouvez copier-coller ce texte ci-dessous directement à un agent IA pour qu'il déploie n'importe quelle nouvelle application sans vous poser de questions :

```text
Tu es mon DevOps personnel. Je souhaite déployer une nouvelle application Full-Stack sur mon serveur VPS existant.
Voici les détails de mon serveur :
- IP du serveur : 31.207.36.107 (Debian 13)
- Accès SSH : root@31.207.36.107
- Outils déjà installés sur le serveur : Node.js 20, PM2, MariaDB, Redis, Nginx, Certbot.

Voici les informations de ma nouvelle application :
- Nom du projet : [NOM_DU_PROJET]
- Dépôt Git : [URL_GITHUB]
- Nom de domaine : [MON-DOMAINE.COM]
- Port backend souhaité : [EX: 5000]

Instructions strictes à suivre :
1. Crée la base de données MariaDB '[NOM_DU_PROJET]_db' et son utilisateur.
2. Clone le dépôt dans '/var/www/[NOM_DU_PROJET]'.
3. Configure le fichier 'backend/.env' avec le port backend dédié et la connexion DB locale MariaDB + Redis local (127.0.0.1:6379).
4. Lance le backend avec PM2 sous le nom '[NOM_DU_PROJET]-api' et sauvegarde PM2.
5. Configure 'frontend/.env.production' avec VITE_API_URL=/api et compile avec 'npm run build'.
6. Crée le virtual host Nginx dans '/etc/nginx/sites-available/[MON-DOMAINE].conf' avec SPA fallback (try_files $uri /index.html) et reverse proxy /api/ vers le port backend dédié.
7. Active le site avec un lien symbolique dans 'sites-enabled' et recharge Nginx.
8. Active le certificat SSL HTTPS avec Certbot pour [MON-DOMAINE.COM] et www.[MON-DOMAINE.COM].
```

