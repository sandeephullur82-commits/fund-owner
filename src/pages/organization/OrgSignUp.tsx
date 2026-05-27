import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import { motion } from "motion/react";
import { Building2, CheckCircle2, ShieldCheck, Smartphone } from "lucide-react";
import ClerkDefaultAuth from "../../components/ClerkDefaultAuth";

export default function OrgSignUp() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      
      {/* LEFT SIDE: Banner representation of mobile banking style device walkthrough (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Ambient background glow dots */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        
        {/* Top Header */}
        <div className="flex justify-between items-center z-10">
          <Link to="/" className="flex items-center gap-2 group border-0 focus:outline-none">
            <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center font-extrabold text-xl shadow-md group-hover:scale-105 transition-transform">
              FC
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">FundCircle</span>
          </Link>
          
          <div className="flex items-center gap-1.5 bg-blue-700/50 backdrop-blur-md p-1 rounded-full border border-blue-500/30">
            <button
              onClick={() => setLanguage("en")}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                language === "en" ? "bg-white text-blue-600" : "text-blue-200 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("kn")}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                language === "kn" ? "bg-white text-blue-600" : "text-blue-200 hover:text-white"
              }`}
            >
              ಕನ್
            </button>
          </div>
        </div>

        {/* Middle Feature list and mockup */}
        <div className="my-auto max-w-lg z-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/40 text-blue-100 text-xs font-bold uppercase tracking-wider">
              <Building2 className="w-4.5 h-4.5" /> Registered Operator System
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
              Create an Operator Account <br />
              <span className="text-blue-250 font-semibold text-3xl">ಖಾತೆ ರಚಿಸಿ ಆಪರೇಟರ್</span>
            </h1>
            <p className="text-blue-100/90 text-sm leading-relaxed">
              Launch and scale your secure mobile pigmy collections ledger, supervise agents, manage customer balances, and digitize collections in moments.
            </p>
          </motion.div>

          <div className="space-y-4">
            <div className="flex gap-3.5 pt-2">
              <div className="w-6 h-6 shrink-0 bg-blue-500/50 rounded-full flex items-center justify-center text-white border border-blue-400/40 mt-1">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm">Easy Daily Pigmy Collection</p>
                <p className="text-xs text-blue-150">ದೈನಂದಿನ ಪಿಗ್ಮಿ ಉಳಿತಾಯ ಸಂಗ್ರಹಣೆ ಸರಳೀಕರಿಸಿ.</p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="w-6 h-6 shrink-0 bg-blue-500/50 rounded-full flex items-center justify-center text-white border border-blue-400/40 mt-1">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm">Microfinance Agent Control</p>
                <p className="text-xs text-blue-150">ಏಜೆಂಟರ ದೈನಂದಿನ ಜವಾಬ್ದಾರಿ ನಿಯಂತ್ರಣ.</p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="w-6 h-6 shrink-0 bg-blue-500/50 rounded-full flex items-center justify-center text-white border border-blue-400/40 mt-1">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm">Secure Bi-Lingual Ledger</p>
                <p className="text-xs text-blue-150">ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್ ಭಾಷೆಯ ಸರಳೀಕೃತ ಲೆಡ್ಜರ್.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 text-xs text-blue-200">
          <p>Standard data safety compliance protocol certified. System running 256-bit database encryption and session audits.</p>
        </div>
      </div>

      {/* RIGHT SIDE: Custom responsive SignUp card container */}
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 md:px-8 bg-white relative">
        {/* Top bar for mobile header (Logo + Lang) */}
        <div className="lg:hidden w-full max-w-md flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-md shadow">
              FC
            </div>
            <span className="font-bold text-lg text-slate-900">FundCircle</span>
          </Link>

          <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-full">
            <button
              onClick={() => setLanguage("en")}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                language === "en" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("kn")}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                language === "kn" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              ಕನ್
            </button>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Central Sign Up state default Clerk auth rendering */}
          <ClerkDefaultAuth initialMode="signup" role="organization" />
        </div>
      </div>
    </div>
  );
}
