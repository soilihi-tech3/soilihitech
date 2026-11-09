import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { 
  LogIn, UserPlus, Lock, Mail, User, AlertCircle, Eye, EyeOff, 
  CheckCircle2, ShieldCheck, RefreshCw, X, ArrowRight, Smartphone, Sparkles
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../api.js";

const OTP_LENGTH = 6;

const COUNTRY_CODES = [
  { flag: "🇰🇲", code: "+269", label: "Comores (+269)" },
  { flag: "🇸🇳", code: "+221", label: "Sénégal (+221)" },
  { flag: "🇫🇷", code: "+33", label: "France (+33)" },
  { flag: "🇾🇹", code: "+262", label: "Mayotte (+262)" },
  { flag: "🇲🇬", code: "+261", label: "Madagascar (+261)" },
  { flag: "🌍", code: "+", label: "Autre (+)" }
];

export default function Login({ defaultMode }) {
  const { login, register, verifyOtp, resendOtp, boutique } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  // Mode initial : signup si sur /inscription ou #signup ou prop defaultMode="signup"
  const isInitialSignup = defaultMode === "signup" || location.pathname === "/inscription" || location.hash === "#signup";
  const [mode, setMode] = useState(isInitialSignup ? "signup" : "signin");

  useEffect(() => {
    if (defaultMode) {
      setMode(defaultMode);
    } else if (location.pathname === "/inscription" || location.hash === "#signup") {
      setMode("signup");
    } else {
      setMode("signin");
    }
  }, [location.pathname, location.hash, defaultMode]);

  function switchMode(newMode) {
    setMode(newMode);
    try {
      const targetPath = newMode === "signup" ? "/inscription" : "/connexion";
      window.history.replaceState(null, "", targetPath);
    } catch (e) {}
  }

  // ─── LOGIN STATE ───
  const [loginForm, setLoginForm] = useState({ identifiant: "", motDePasse: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginErreur, setLoginErreur] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ─── SIGNUP STATE ───
  const [signupForm, setSignupForm] = useState({ nom: "", email: "", motDePasse: "" });
  const [indicatif, setIndicatif] = useState("+269");
  const [nationalPhone, setNationalPhone] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupErreur, setSignupErreur] = useState("");
  const [signupSucces, setSignupSucces] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  // ─── OTP STATE (SI REQUIS) ───
  const [signupStep, setSignupStep] = useState(1); // 1 = formulaire, 2 = otp
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const otpRefs = useRef([]);
  const [targetContact, setTargetContact] = useState({ email: "", telephone: "" });
  const [verified, setVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900);
  const [otpLoading, setOtpLoading] = useState(false);

  // ─── MODAL MOT DE PASSE OUBLIÉ ───
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSucces, setForgotSucces] = useState("");
  const [forgotErreur, setForgotErreur] = useState("");

  // Token de réinitialisation dans l'URL (?resetToken=...)
  const resetToken = params.get("resetToken");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSucces, setResetSucces] = useState("");
  const [resetErreur, setResetErreur] = useState("");

  useEffect(() => {
    if (resetToken) {
      setForgotModalOpen(true);
    }
  }, [resetToken]);

  // Timer OTP
  useEffect(() => {
    let timer;
    if (signupStep === 2 && timeLeft > 0 && !verified) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [signupStep, timeLeft, verified]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // ─── SOUMISSION CONNEXION ───
  async function onSubmitLogin(e) {
    e.preventDefault();
    setLoginErreur("");
    setLoginLoading(true);
    try {
      const user = await login(loginForm.identifiant, loginForm.motDePasse);
      const redirect = params.get("redirect");
      if (user?.mustChangePassword) return;

      if (redirect) navigate(redirect);
      else if (user.role === "super_admin") navigate("/super-admin");
      else if (user.role === "admin" || user.role === "employe") navigate("/admin");
      else navigate("/");
    } catch (err) {
      setLoginErreur(err.response?.data?.message || "Identifiants ou mot de passe incorrects.");
    } finally {
      setLoginLoading(false);
    }
  }

  // ─── SOUMISSION INSCRIPTION ───
  async function onSubmitSignup(e) {
    e.preventDefault();
    setSignupErreur("");
    setSignupSucces("");

    const fullPhone = nationalPhone.trim().startsWith("+") 
      ? nationalPhone.trim() 
      : `${indicatif}${nationalPhone.trim().replace(/^0+/, "")}`;

    if (!nationalPhone.trim()) {
      setSignupErreur("Veuillez renseigner votre numéro de téléphone mobile.");
      return;
    }

    setSignupLoading(true);
    try {
      const res = await register(
        signupForm.nom.trim(),
        signupForm.email.trim() || undefined,
        fullPhone,
        signupForm.motDePasse
      );

      if (res?.requireOtp) {
        setTargetContact({ email: res.email || signupForm.email, telephone: res.telephone || fullPhone });
        setSignupStep(2);
        setTimeLeft(900);
        setSignupSucces("Code OTP envoyé ! Saisissez les 6 chiffres reçus.");
      } else {
        const redirect = params.get("redirect");
        if (redirect) navigate(redirect);
        else navigate("/");
      }
    } catch (err) {
      setSignupErreur(err.response?.data?.message || "Impossible de créer le compte.");
    } finally {
      setSignupLoading(false);
    }
  }

  // ─── GESTION OTP ───
  function handleOtpInput(index, e) {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = val;
    setOtpDigits(next);
    if (val && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
    if (pasted.length > 0) {
      const next = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setOtpDigits(next);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      otpRefs.current[focusIdx]?.focus();
    }
  }

  const otpCode = otpDigits.join("");
  const isOtpComplete = otpCode.length === OTP_LENGTH;

  async function onSubmitOtp(e) {
    e.preventDefault();
    setSignupErreur("");
    setSignupSucces("");
    if (!isOtpComplete) {
      setSignupErreur("Veuillez saisir les 6 chiffres du code OTP.");
      return;
    }
    setOtpLoading(true);
    try {
      await verifyOtp(targetContact.email, targetContact.telephone, otpCode);
      setVerified(true);
      setSignupSucces("Vérification réussie ! Bienvenue sur notre boutique.");
      setTimeout(() => {
        const redirect = params.get("redirect");
        navigate(redirect || "/");
      }, 1500);
    } catch (err) {
      setSignupErreur(err.response?.data?.message || "Code OTP incorrect ou expiré.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    setSignupErreur("");
    setSignupSucces("");
    setOtpLoading(true);
    try {
      const res = await resendOtp(targetContact.email, targetContact.telephone);
      setSignupSucces(res?.message || "Un nouveau code OTP a été envoyé.");
      setTimeLeft(900);
    } catch (err) {
      setSignupErreur(err.response?.data?.message || "Erreur lors du renvoi du code.");
    } finally {
      setOtpLoading(false);
    }
  }

  // ─── MOT DE PASSE OUBLIÉ ACTIONS ───
  async function handleSendForgot(e) {
    e.preventDefault();
    setForgotErreur("");
    setForgotSucces("");
    setForgotLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSucces(res.data?.message || "Un e-mail de réinitialisation a été envoyé.");
    } catch (err) {
      setForgotErreur(err.response?.data?.message || "Erreur lors de l'envoi de l'e-mail.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetErreur("");
    setResetSucces("");
    setResetLoading(true);
    try {
      const res = await api.post("/auth/reset-password", { token: resetToken, nouveauMotDePasse: newPassword });
      setResetSucces(res.data?.message || "Mot de passe réinitialisé avec succès !");
      setTimeout(() => {
        setForgotModalOpen(false);
        navigate("/connexion");
      }, 2000);
    } catch (err) {
      setResetErreur(err.response?.data?.message || "Lien invalide ou expiré.");
    } finally {
      setResetLoading(false);
    }
  }

  const storeName = boutique?.nom || "Boutique Officielle";
  const storeLogo = boutique?.logoUrl || "";

  return (
    <>
      {/* ─── STYLES DU SLIDING DUAL AUTH (THEME ROYAL/ELECTRIC BLUE) ─── */}
      <style>{`
        .bs-dual-root {
          --p1: #1E40AF;
          --p2: #2563EB;
          --p3: #3B82F6;
          --ink: #0F172A;
          --muted: #64748B;
          --line: #E2E8F0;
          --ease: cubic-bezier(.65, .05, .25, 1);
        }
        .bs-dual-wrapper {
          position: relative;
          min-height: calc(100vh - 140px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 16px;
          overflow: hidden;
          background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #2563EB 100%);
        }
        .bs-dual-wrapper::before,
        .bs-dual-wrapper::after,
        .bs-dual-orb {
          content: "";
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }
        .bs-dual-wrapper::before {
          width: 440px;
          height: 440px;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.22), rgba(255,255,255,.03));
          top: -120px;
          left: -100px;
          animation: dualFl 11s ease-in-out infinite;
        }
        .bs-dual-wrapper::after {
          width: 380px;
          height: 380px;
          background: radial-gradient(circle at 30% 30%, rgba(59,130,246,.45), rgba(30,64,175,.08));
          bottom: -120px;
          right: -80px;
          animation: dualFl 13s ease-in-out infinite reverse;
        }
        .bs-dual-orb {
          width: 140px;
          height: 140px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.22);
          backdrop-filter: blur(8px);
          right: 12%;
          top: 12%;
          animation: dualFl 9s ease-in-out infinite;
        }
        @keyframes dualFl {
          50% { transform: translate(26px, -30px) scale(1.08); }
        }

        .bs-dual-container {
          position: relative;
          z-index: 1;
          width: 920px;
          max-width: 100%;
          min-height: 610px;
          background: #ffffff;
          border-radius: 26px;
          overflow: hidden;
          box-shadow: 0 30px 70px -15px rgba(15, 23, 42, 0.55);
        }

        .bs-dual-form-box {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 40px;
          transition: transform .8s var(--ease), opacity .35s;
          overflow-y: auto;
        }
        .bs-dual-form-box.signin {
          z-index: 2;
        }
        .bs-dual-form-box.signup {
          opacity: 0;
          pointer-events: none;
          z-index: 1;
        }
        .bs-dual-container.active .bs-dual-form-box.signin {
          transform: translateX(100%);
          opacity: 0;
          pointer-events: none;
        }
        .bs-dual-container.active .bs-dual-form-box.signup {
          transform: translateX(100%);
          opacity: 1;
          pointer-events: auto;
          z-index: 5;
        }

        .bs-dual-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .bs-dual-head {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-bottom: 6px;
        }
        .bs-dual-head h1 {
          font-size: 24px;
          font-weight: 800;
          color: var(--p1);
          line-height: 1.2;
          margin: 0;
        }
        .bs-dual-head .sub {
          font-size: 12.5px;
          color: var(--muted);
        }

        .bs-dual-logo-badge {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #ffffff;
          display: grid;
          place-items: center;
          padding: 7px;
          margin-bottom: 4px;
          box-shadow: 0 10px 22px -8px rgba(37, 99, 235, 0.45);
          animation: dualBob 4s ease-in-out infinite;
        }
        .bs-dual-logo-badge::after {
          content: "";
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          border: 2px dashed rgba(37, 99, 235, 0.45);
          animation: dualSpin 18s linear infinite;
        }
        .bs-dual-logo-badge img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 50%;
        }
        @keyframes dualBob { 50% { transform: translateY(-4px); } }
        @keyframes dualSpin { to { transform: rotate(360deg); } }

        /* Champs avec libellé flottant */
        .bs-dual-fl {
          position: relative;
          width: 100%;
        }
        .bs-dual-fl input {
          width: 100%;
          height: 52px;
          padding: 20px 42px 6px 42px;
          background: #F8FAFC;
          border: 1.5px solid var(--line);
          border-radius: 14px;
          font: inherit;
          font-size: 13.5px;
          color: var(--ink);
          outline: 0;
          transition: border-color .25s, box-shadow .25s, background .25s;
        }
        .bs-dual-fl label {
          position: absolute;
          left: 42px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 13px;
          color: var(--muted);
          pointer-events: none;
          transition: top .2s var(--ease), transform .2s var(--ease), font-size .2s, color .2s;
        }
        .bs-dual-fl input:focus + label,
        .bs-dual-fl input:not(:placeholder-shown) + label {
          top: 10px;
          transform: none;
          font-size: 10.5px;
          font-weight: 700;
          color: var(--p1);
        }
        .bs-dual-fl input:focus {
          border-color: var(--p2);
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
        }
        .bs-dual-fl .bs-dual-ic {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          transition: color .25s;
          display: grid;
          pointer-events: none;
        }
        .bs-dual-fl input:focus ~ .bs-dual-ic {
          color: var(--p2);
        }
        .bs-dual-fl .bs-dual-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border: 0;
          background: none;
          border-radius: 50%;
          cursor: pointer;
          color: var(--muted);
          display: grid;
          place-items: center;
          transition: all .2s;
        }
        .bs-dual-fl .bs-dual-eye:hover {
          background: #EFF6FF;
          color: var(--p1);
        }

        /* Ligne de téléphone avec indicatif */
        .bs-dual-phone {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 10px;
        }
        .bs-dual-cc {
          position: relative;
        }
        .bs-dual-cc select {
          width: 100%;
          height: 52px;
          padding: 0 24px 0 12px;
          background: #F8FAFC;
          border: 1.5px solid var(--line);
          border-radius: 14px;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
          outline: 0;
          appearance: none;
          cursor: pointer;
          transition: border-color .25s, box-shadow .25s;
        }
        .bs-dual-cc select:focus {
          border-color: var(--p2);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
        }
        .bs-dual-cc::after {
          content: "";
          position: absolute;
          right: 12px;
          top: 50%;
          width: 7px;
          height: 7px;
          border-right: 2px solid var(--muted);
          border-bottom: 2px solid var(--muted);
          transform: translateY(-70%) rotate(45deg);
          pointer-events: none;
        }
        .bs-dual-phone .bs-dual-fl input { padding-left: 14px; }
        .bs-dual-phone .bs-dual-fl label { left: 14px; }

        .bs-dual-forgot {
          align-self: flex-end;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--p1);
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-top: -2px;
        }
        .bs-dual-forgot:hover { text-decoration: underline; }

        /* Bouton principal avec shimmer */
        .bs-dual-btn {
          position: relative;
          overflow: hidden;
          height: 50px;
          border: 0;
          border-radius: 14px;
          cursor: pointer;
          margin-top: 4px;
          background: linear-gradient(90deg, #1E40AF 0%, #2563EB 100%);
          color: #ffffff;
          font: inherit;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: .06em;
          text-transform: uppercase;
          box-shadow: 0 10px 22px -8px rgba(30, 64, 175, 0.65);
          transition: transform .2s, box-shadow .2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bs-dual-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 26px -8px rgba(30, 64, 175, 0.75);
        }
        .bs-dual-btn:active:not(:disabled) { transform: scale(.98); }
        .bs-dual-btn:disabled { opacity: .7; cursor: not-allowed; }
        .bs-dual-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: -60%;
          width: 40%;
          height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.4), transparent);
          transform: skewX(-20deg);
          transition: left .7s;
        }
        .bs-dual-btn:hover:not(:disabled)::after { left: 130%; }

        .bs-dual-spin {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,.4);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: dualSpin .7s linear infinite;
        }

        .bs-dual-m-switch {
          display: none;
          text-align: center;
          font-size: 13px;
          color: var(--muted);
          margin-top: 6px;
        }
        .bs-dual-m-switch button {
          border: 0;
          background: none;
          font: inherit;
          font-weight: 700;
          color: var(--p1);
          cursor: pointer;
          text-decoration: underline;
          margin-left: 4px;
        }

        /* Overlay Sliding Bleu Électrique / Royal */
        .bs-dual-overlay-container {
          position: absolute;
          top: 0;
          left: 50%;
          width: 50%;
          height: 100%;
          overflow: hidden;
          z-index: 100;
          transition: transform .8s var(--ease);
        }
        .bs-dual-container.active .bs-dual-overlay-container {
          transform: translateX(-100%);
        }
        .bs-dual-overlay {
          position: relative;
          left: -100%;
          width: 200%;
          height: 100%;
          color: #ffffff;
          overflow: hidden;
          background: linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 50%, #2563EB 100%);
          transition: transform .8s var(--ease);
        }
        .bs-dual-container.active .bs-dual-overlay {
          transform: translateX(50%);
        }
        .bs-dual-overlay::before,
        .bs-dual-overlay::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,.14);
          animation: dualFl 10s ease-in-out infinite;
        }
        .bs-dual-overlay::before {
          width: 280px;
          height: 280px;
          top: -80px;
          left: 36%;
        }
        .bs-dual-overlay::after {
          width: 220px;
          height: 220px;
          bottom: -60px;
          right: 38%;
          animation-delay: -5s;
        }
        .bs-dual-panel {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          padding: 0 42px;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 14px;
          transition: transform .8s var(--ease);
        }
        .bs-dual-panel.left {
          transform: translateX(-20%);
        }
        .bs-dual-panel.right {
          right: 0;
        }
        .bs-dual-container.active .bs-dual-panel.left {
          transform: translateX(0);
        }
        .bs-dual-container.active .bs-dual-panel.right {
          transform: translateX(20%);
        }
        .bs-dual-panel h2 {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }
        .bs-dual-panel p {
          font-size: 13.5px;
          line-height: 1.65;
          opacity: .95;
          max-width: 280px;
          margin: 0;
        }
        .bs-dual-ghost {
          margin-top: 8px;
          height: 44px;
          padding: 0 34px;
          border-radius: 12px;
          cursor: pointer;
          background: transparent;
          color: #ffffff;
          border: 2px solid #ffffff;
          font: inherit;
          font-weight: 700;
          font-size: 12.5px;
          letter-spacing: .08em;
          text-transform: uppercase;
          transition: background .25s, color .25s, transform .2s;
        }
        .bs-dual-ghost:hover {
          background: #ffffff;
          color: var(--p1);
          transform: translateY(-2px);
        }

        .bs-dual-alert {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 12.5px;
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.4;
        }
        .bs-dual-alert.error {
          background: #FEF2F2;
          color: #991B1B;
          border: 1px solid #FECACA;
        }
        .bs-dual-alert.success {
          background: #F0FDF4;
          color: #166534;
          border: 1px solid #BBF7D0;
        }

        /* Responsive Mobile (<820px) */
        @media (max-width: 820px) {
          .bs-dual-wrapper {
            padding: 16px 12px;
            align-items: flex-start;
            min-height: auto;
          }
          .bs-dual-container {
            height: auto;
            min-height: auto;
            border-radius: 22px;
          }
          .bs-dual-overlay-container {
            display: none !important;
          }
          .bs-dual-form-box {
            position: relative;
            width: 100%;
            height: auto;
            padding: 28px 20px 24px;
            transform: none !important;
            transition: none;
          }
          .bs-dual-form-box.signup {
            display: none;
            opacity: 1;
            pointer-events: auto;
          }
          .bs-dual-container.active .bs-dual-form-box.signup {
            display: flex;
          }
          .bs-dual-container.active .bs-dual-form-box.signin {
            display: none;
          }
          .bs-dual-m-switch {
            display: block;
          }
          .bs-dual-fl input,
          .bs-dual-cc select {
            font-size: 15px;
            height: 54px;
          }
        }
      `}</style>

      <div className="bs-dual-root bs-dual-wrapper">
        <div className="bs-dual-orb"></div>

        <div className={`bs-dual-container ${mode === "signup" ? "active" : ""}`}>
          
          {/* ════════════════════════════════════════════════════════════
              FORMULAIRE 1 : INSCRIPTION CLIENT (SIGN UP)
          ════════════════════════════════════════════════════════════ */}
          <div className="bs-dual-form-box signup">
            {signupStep === 1 ? (
              <form onSubmit={onSubmitSignup} className="bs-dual-form" noValidate>
                <div className="bs-dual-head">
                  <div className="bs-dual-logo-badge">
                    {storeLogo ? (
                      <img src={storeLogo} alt={storeName} />
                    ) : (
                      <UserPlus size={30} color="#1E40AF" />
                    )}
                  </div>
                  <h1>Créer un compte client</h1>
                  <span className="sub">Rejoignez-nous en quelques clics</span>
                </div>

                {signupErreur && (
                  <div className="bs-dual-alert error">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{signupErreur}</span>
                  </div>
                )}
                {signupSucces && (
                  <div className="bs-dual-alert success">
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{signupSucces}</span>
                  </div>
                )}

                {/* Nom complet */}
                <div className="bs-dual-fl">
                  <input
                    id="s_nom"
                    type="text"
                    placeholder=" "
                    autoComplete="name"
                    required
                    value={signupForm.nom}
                    onChange={(e) => setSignupForm({ ...signupForm, nom: e.target.value })}
                  />
                  <label htmlFor="s_nom">Nom complet *</label>
                  <span className="bs-dual-ic"><User size={18} /></span>
                </div>

                {/* Téléphone mobile avec indicatif pays */}
                <div className="bs-dual-phone">
                  <div className="bs-dual-cc">
                    <select
                      aria-label="Indicatif pays"
                      value={indicatif}
                      onChange={(e) => setIndicatif(e.target.value)}
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="bs-dual-fl">
                    <input
                      id="s_phone"
                      type="tel"
                      inputMode="tel"
                      placeholder=" "
                      autoComplete="tel-national"
                      required
                      value={nationalPhone}
                      onChange={(e) => setNationalPhone(e.target.value)}
                    />
                    <label htmlFor="s_phone">Téléphone mobile *</label>
                  </div>
                </div>

                {/* E-mail optionnel */}
                <div className="bs-dual-fl">
                  <input
                    id="s_email"
                    type="email"
                    placeholder=" "
                    autoComplete="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  />
                  <label htmlFor="s_email">E-mail (optionnel)</label>
                  <span className="bs-dual-ic"><Mail size={18} /></span>
                </div>

                {/* Mot de passe */}
                <div className="bs-dual-fl">
                  <input
                    id="s_pwd"
                    type={showSignupPassword ? "text" : "password"}
                    placeholder=" "
                    minLength={8}
                    autoComplete="new-password"
                    required
                    value={signupForm.motDePasse}
                    onChange={(e) => setSignupForm({ ...signupForm, motDePasse: e.target.value })}
                  />
                  <label htmlFor="s_pwd">Mot de passe (8 car. min.) *</label>
                  <span className="bs-dual-ic"><Lock size={18} /></span>
                  <button
                    type="button"
                    className="bs-dual-eye"
                    aria-label={showSignupPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                  >
                    {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button className="bs-dual-btn" type="submit" disabled={signupLoading}>
                  {signupLoading ? <span className="bs-dual-spin"></span> : <span>Créer mon compte</span>}
                </button>

                <p className="bs-dual-m-switch">
                  Vous avez déjà un compte ?{" "}
                  <button type="button" onClick={() => switchMode("signin")}>
                    Se connecter
                  </button>
                </p>
              </form>
            ) : (
              /* ── ÉTAPE 2 : CODE OTP DE VALIDATION ── */
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%", background: "#EFF6FF",
                  color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto"
                }}>
                  {verified ? <CheckCircle2 size={32} color="#16a34a" /> : <ShieldCheck size={32} />}
                </div>

                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 4px" }}>
                    {verified ? "Compte validé avec succès !" : "Vérification OTP"}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    Un code à 6 chiffres a été envoyé au{" "}
                    <strong style={{ color: "var(--ink)" }}>{targetContact.email || targetContact.telephone}</strong>
                  </p>
                </div>

                {signupErreur && (
                  <div className="bs-dual-alert error">
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{signupErreur}</span>
                  </div>
                )}
                {signupSucces && (
                  <div className="bs-dual-alert success">
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{signupSucces}</span>
                  </div>
                )}

                {!verified && (
                  <form onSubmit={onSubmitOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpInput(idx, e)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          style={{
                            width: 44, height: 50, textAlign: "center", fontSize: 20, fontWeight: 800,
                            border: digit ? "2px solid #2563EB" : "1.5px solid var(--line)",
                            borderRadius: 12, background: digit ? "#EFF6FF" : "#F8FAFC",
                            outline: "none", color: "#1E3A8A"
                          }}
                        />
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--muted)" }}>
                      <span>Expire dans: <strong style={{ color: timeLeft < 60 ? "#DC2626" : "var(--ink)" }}>{formatTime(timeLeft)}</strong></span>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpLoading || timeLeft > 840}
                        style={{
                          background: "none", border: "none", color: "#1D4ED8",
                          fontWeight: 700, cursor: "pointer", fontSize: 12
                        }}
                      >
                        Renvoyer le code
                      </button>
                    </div>

                    <button className="bs-dual-btn" type="submit" disabled={otpLoading || !isOtpComplete}>
                      {otpLoading ? <span className="bs-dual-spin"></span> : <span>Valider le code</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignupStep(1)}
                      style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12.5, cursor: "pointer" }}
                    >
                      ← Modifier mes coordonnées
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════
              FORMULAIRE 2 : CONNEXION (SIGN IN)
          ════════════════════════════════════════════════════════════ */}
          <div className="bs-dual-form-box signin">
            <form onSubmit={onSubmitLogin} className="bs-dual-form" noValidate>
              <div className="bs-dual-head">
                <div className="bs-dual-logo-badge">
                  {storeLogo ? (
                    <img src={storeLogo} alt={storeName} />
                  ) : (
                    <LogIn size={28} color="#1E40AF" />
                  )}
                </div>
                <h1>Espace Connexion</h1>
                <span className="sub">Connectez-vous pour accéder à votre espace</span>
              </div>

              {loginErreur && (
                <div className="bs-dual-alert error">
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{loginErreur}</span>
                </div>
              )}

              {/* Téléphone ou e-mail */}
              <div className="bs-dual-fl">
                <input
                  id="l_identifiant"
                  type="text"
                  placeholder=" "
                  autoComplete="username"
                  required
                  value={loginForm.identifiant}
                  onChange={(e) => setLoginForm({ ...loginForm, identifiant: e.target.value })}
                />
                <label htmlFor="l_identifiant">Téléphone ou adresse e-mail</label>
                <span className="bs-dual-ic"><Mail size={18} /></span>
              </div>

              {/* Mot de passe */}
              <div className="bs-dual-fl">
                <input
                  id="l_pwd"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder=" "
                  autoComplete="current-password"
                  required
                  value={loginForm.motDePasse}
                  onChange={(e) => setLoginForm({ ...loginForm, motDePasse: e.target.value })}
                />
                <label htmlFor="l_pwd">Mot de passe</label>
                <span className="bs-dual-ic"><Lock size={18} /></span>
                <button
                  type="button"
                  className="bs-dual-eye"
                  aria-label={showLoginPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="button"
                className="bs-dual-forgot"
                onClick={() => {
                  setForgotModalOpen(true);
                  setForgotErreur("");
                  setForgotSucces("");
                }}
              >
                Mot de passe oublié ?
              </button>

              <button className="bs-dual-btn" type="submit" disabled={loginLoading}>
                {loginLoading ? <span className="bs-dual-spin"></span> : <span>Se connecter</span>}
              </button>

              <p className="bs-dual-m-switch">
                Pas encore de compte client ?{" "}
                <button type="button" onClick={() => switchMode("signup")}>
                  Créer un compte
                </button>
              </p>
            </form>
          </div>

          {/* ════════════════════════════════════════════════════════════
              PANEL COULISSANT (OVERLAY SLIDER)
          ════════════════════════════════════════════════════════════ */}
          <div className="bs-dual-overlay-container">
            <div className="bs-dual-overlay">
              {/* Panneau gauche (visible quand signup est actif) */}
              <div className="bs-dual-panel left">
                <h2>Bon retour !</h2>
                <p>Pour rester connecté avec nous, veuillez vous connecter avec vos identifiants.</p>
                <button
                  className="bs-dual-ghost"
                  type="button"
                  onClick={() => switchMode("signin")}
                >
                  Se connecter
                </button>
              </div>

              {/* Panneau droit (visible quand signin est actif) */}
              <div className="bs-dual-panel right">
                <h2>Bonjour !</h2>
                <p>Créez votre compte client en 1 minute pour commander et profiter de vos avantages exclusifs chez {storeName}.</p>
                <button
                  className="bs-dual-ghost"
                  type="button"
                  onClick={() => switchMode("signup")}
                >
                  Créer un compte
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL : MOT DE PASSE OUBLIÉ & RÉINITIALISATION
      ════════════════════════════════════════════════════════════ */}
      {forgotModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div style={{
            background: "#ffffff", borderRadius: 20, width: "100%", maxWidth: 440,
            padding: "28px 24px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", position: "relative"
          }}>
            <button
              onClick={() => { setForgotModalOpen(false); setForgotErreur(""); setForgotSucces(""); }}
              style={{
                position: "absolute", top: 16, right: 16, background: "#F1F5F9",
                border: "none", borderRadius: "50%", width: 32, height: 32,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#64748B"
              }}
            >
              <X size={16} />
            </button>

            {!resetToken ? (
              <form onSubmit={handleSendForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: "50%", background: "#EFF6FF",
                    color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 10px"
                  }}>
                    <Lock size={24} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                    Mot de passe oublié
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                    Saisissez votre e-mail pour recevoir le lien de réinitialisation sécurisé.
                  </p>
                </div>

                {forgotErreur && (
                  <div className="bs-dual-alert error">
                    <AlertCircle size={16} />
                    <span>{forgotErreur}</span>
                  </div>
                )}
                {forgotSucces && (
                  <div className="bs-dual-alert success">
                    <CheckCircle2 size={16} />
                    <span>{forgotSucces}</span>
                  </div>
                )}

                <div className="bs-dual-fl">
                  <input
                    type="email"
                    placeholder=" "
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                  <label>Votre adresse e-mail</label>
                  <span className="bs-dual-ic"><Mail size={18} /></span>
                </div>

                <button className="bs-dual-btn" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <span className="bs-dual-spin"></span> : <span>Envoyer le lien</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                    Nouveau mot de passe
                  </h3>
                  <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                    Saisissez votre nouveau mot de passe sécurisé.
                  </p>
                </div>

                {resetErreur && (
                  <div className="bs-dual-alert error">
                    <AlertCircle size={16} />
                    <span>{resetErreur}</span>
                  </div>
                )}
                {resetSucces && (
                  <div className="bs-dual-alert success">
                    <CheckCircle2 size={16} />
                    <span>{resetSucces}</span>
                  </div>
                )}

                <div className="bs-dual-fl">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder=" "
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <label>Nouveau mot de passe (8 car. min.)</label>
                  <span className="bs-dual-ic"><Lock size={18} /></span>
                  <button
                    type="button"
                    className="bs-dual-eye"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button className="bs-dual-btn" type="submit" disabled={resetLoading}>
                  {resetLoading ? <span className="bs-dual-spin"></span> : <span>Enregistrer le mot de passe</span>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
