import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import { Building2 } from "lucide-react";
import ClerkDefaultAuth from "../../components/ClerkDefaultAuth";

export default function OrgSignIn() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="flex justify-between items-center px-2">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
              FC
            </div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">FundCircle</span>
          </Link>

          <div className="flex bg-white shadow-sm border border-slate-200/65 p-1 rounded-full">
            <button
              onClick={() => setLanguage("en")}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${
                language === "en" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("kn")}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${
                language === "kn" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              ಕನ್
            </button>
          </div>
        </div>

        {/* Dynamic Clerk auth rendering */}
        <ClerkDefaultAuth initialMode="signin" role="organization" />

        {/* Footer help line */}
        <div className="text-center text-xs text-slate-400 font-medium h-4">
          {language === "kn" ? "ಸಹಾಯ ಅಥವಾ ಬೆಂಬಲಕ್ಕಾಗಿ ಇಮೇಲ್ ಮಾಡಿ: support@fundcircle.com" : "Need workspace recovery support? Reach out to administrator"}
        </div>
      </div>
    </div>
  );
}
