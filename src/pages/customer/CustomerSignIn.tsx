import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import ClerkDefaultAuth from "../../components/ClerkDefaultAuth";

export default function CustomerSignIn() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="flex justify-between items-center px-1">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
              FC
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">FundCircle</span>
          </Link>

          <div className="flex bg-white shadow-sm border border-slate-200 p-1 rounded-full">
            <button
              onClick={() => setLanguage("en")}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${
                language === "en" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("kn")}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${
                language === "kn" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              ಕನ್
            </button>
          </div>
        </div>

        {/* Default Clerk auth with Customer theme wrapper */}
        <ClerkDefaultAuth initialMode="signin" role="customer" />

        {/* Help Info */}
        <div className="text-center text-xs text-slate-400 font-medium h-4">
          {language === "kn" ? "ಖಾತೆಯ ವಿವರಗಳಿಗೆ ಲಾಗಿನ್ ಅಗತ್ಯವಿದೆ" : "Double-check with your agent if you face logging problems"}
        </div>
      </div>
    </div>
  );
}
