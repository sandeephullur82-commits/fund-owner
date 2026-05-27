import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "kn";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    title: "FundCircle",
    subTitle: "Simple Pigmy collection notebook for daily savings.",
    pigmyOperator: "Pigmy Operator",
    agent: "Collection Agent",
    customer: "Customer",
    operatorDesc: "Manage agents, set targets, approve loans, and view complete daily/monthly collections.",
    agentDesc: "Visit assigned customers, collect daily pigmy savings, collect EMIs, and generate instant receipts.",
    customerDesc: "Check your savings history, review loan status, check upcoming EMIs, and download receipts.",
    login: "Login",
    register: "Register",
    logout: "Logout",
    todayCollection: "Today's Collection",
    totalCustomers: "Total Customers",
    totalPlatformBalance: "Total Savings Balance",
    activeLoans: "Active Loans",
    recentCollections: "Recent Collections",
    quickActions: "Quick Actions",
    addCustomer: "Add Customer",
    addCustomerKn: "ಗ್ರಾಹಕರನ್ನು ಸೇರಿಸಿ",
    addAgent: "Add Agent",
    generateDailyReport: "Generate Daily Report",
    searchPlaceholder: "Search by name or phone...",
    phoneNumber: "Phone Number",
    fullName: "Full Name",
    emailAddress: "Email Address",
    assignAgent: "Assign Agent",
    saveCustomer: "Save Customer",
    manageCustomers: "Manage Customers",
    manageAgents: "Manage Agents",
    customerList: "Customer List",
    balance: "Balance",
    joined: "Joined",
    assignedArea: "Assigned Area",
    saveAgent: "Save Agent",
    collectionHistory: "Collection History",
    dateTime: "Date & Time",
    collectedBy: "Collected By",
    status: "Status",
    amount: "Amount",
    loansEmi: "Loans & EMI",
    requestedOn: "Requested On",
    principal: "Principal Amount (₹)",
    duration: "Duration (Months)",
    calculatedEmi: "Calculated EMI",
    actions: "Actions",
    approve: "Approve",
    reject: "Reject",
    todaysSummary: "Today's Summary",
    assignedCustomers: "Assigned Customers",
    recentDeposits: "Recent Deposits",
    collectDailySavings: "Collect Daily Savings",
    confirmCollection: "Confirm Collection",
    amountCollected: "Amount Collected (₹)",
    myPigmy: "My Pigmy",
    totalSavingsBalance: "Total Savings Balance",
    applyForLoan: "Apply for Loan",
    loanPending: "Loan Pending Review",
    submitApplication: "Submit Application",
    loanDetails: "Standard monthly interest of 2% is calculated.",
    profileNotFound: "Profile Not Found",
    profileNotFoundDesc: "Your email address is not registered in our system. Please contact your local operator.",
    todaysPlan: "Today's Plan",
    myCustomers: "My Customers",
    kannadaToggle: "ಕನ್ನಡ",
    englishToggle: "English",
  },
  kn: {
    title: "ಫಂಡ್‌ಸರ್ಕಲ್ (FundCircle)",
    subTitle: "ದೈನಂದಿನ ಉಳಿತಾಯ ಸಂಗ್ರಹಣೆಗಳ ಸರಳ ಡಿಜಿಟಲ್ ಪಿಗ್ಮಿ ಡೈರಿ.",
    pigmyOperator: "ಪಿಗ್ಮಿ ಆಪರೇಟರ್",
    agent: "ಸಂಗ್ರಹಣಾ ಏಜೆಂಟ್",
    customer: "ಗ್ರಾಹಕರು",
    operatorDesc: "ಏಜೆಂಟರನ್ನು ನಿರ್ವಹಿಸಿ, ಗುರಿಗಳನ್ನು ನಿಗದಿಪಡಿಸಿ, ಸಾಲಗಳನ್ನು ಅನುಮೋದಿಸಿ ಮತ್ತು ಸಂಪೂರ್ಣ ಸಂಗ್ರಹಣೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ.",
    agentDesc: "ಹಂಚಿಕೆಯಾದ ಗ್ರಾಹಕರನ್ನು ಭೇಟಿ ಮಾಡಿ, ದೈನಂದಿನ ಪಿಗ್ಮಿ ಉಳಿತಾಯ ಮತ್ತು ಇಎಂಐ ಸಂಗ್ರಹಿಸಿ, ರಶೀದಿ ನೀಡಿ.",
    customerDesc: "ನಿಮ್ಮ ಉಳಿತಾಯದ ಇತಿಹಾಸ, ಸಾಲದ ಸ್ಥಿತಿ, ಮುಂಬರುವ ಇಎಂಐಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ರಶೀದಿಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.",
    login: "ಲಾಗಿನ್",
    register: "ನೋಂದಣಿ ಸೇರಿ",
    logout: "ಲಾಗ್ ಔಟ್",
    todayCollection: "ಇಂದಿನ ಸಂಗ್ರಹಣೆ",
    totalCustomers: "ಒಟ್ಟು ಗ್ರಾಹಕರು",
    totalPlatformBalance: "ಒಟ್ಟು ಉಳಿತಾಯದ ಬಾಕಿ",
    activeLoans: "ಚಾಲ್ತಿ ಸಾಲಗಳು",
    recentCollections: "ಇತ್ತೀಚಿನ ಸಂಗ್ರಹಣೆಗಳು",
    quickActions: "ತ್ವರಿತ ಕ್ರಮಗಳು",
    addCustomer: "ಹೊಸ ಗ್ರಾಹಕರ ಸೇರ್ಪಡೆ",
    addCustomerKn: "ಗ್ರಾಹಕರನ್ನು ಸೇರಿಸಿ",
    addAgent: "ಹೊಸ ಏಜೆಂಟ್ ಸೇರ್ಪಡೆ",
    generateDailyReport: "ದೈನಂದಿನ ವರದಿ ರಚಿಸಿ",
    searchPlaceholder: "ಹೆಸರು ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆ ಮೂಲಕ ಹುಡುಕಿ...",
    phoneNumber: "ಫೋನ್ ಸಂಖ್ಯೆ",
    fullName: "ಪೂರ್ಣ ಹೆಸರು",
    emailAddress: "ಇಮೇಲ್ ವಿಳಾಸ",
    assignAgent: "ಏಜೆಂಟ್ ನಿಯೋಜಿಸಿ",
    saveCustomer: "ಗ್ರಾಹಕರನ್ನು ಉಳಿಸಿ",
    manageCustomers: "ಗ್ರಾಹಕರ ನಿರ್ವಹಣೆ",
    manageAgents: "ಏಜೆಂಟರ ನಿರ್ವಹಣೆ",
    customerList: "ಗ್ರಾಹಕರ ಪಟ್ಟಿ",
    balance: "ಬಾಕಿ ಹಣ(ಶೇಖರಣೆ)",
    joined: "ಸೇರಿದ ದಿನಾಂಕ",
    assignedArea: "ನಿಯೋಜಿತ ಪ್ರದೇಶ",
    saveAgent: "ಏಜೆಂಟ್ ಉಳಿಸಿ",
    collectionHistory: "ಸಂಗ್ರಹಣೆ ಇತಿಹಾಸ",
    dateTime: "ದಿನಾಂಕ ಮತ್ತು ಸಮಯ",
    collectedBy: "ಸಂಗ್ರಹಿಸಿದವರು",
    status: "ಸ್ಥಿತಿ",
    amount: "ಮೊತ್ತ",
    loansEmi: "ಸಾಲಗಳು ಮತ್ತು ಇಎಂಐ",
    requestedOn: "ವಿನಂತಿಸಿದ ದಿನ",
    principal: "ಸಾಲದ ಮೊತ್ತ (₹)",
    duration: "ಅವಧಿ (ತಿಂಗಳುಗಳು)",
    calculatedEmi: "ತಿಂಗಳ ಇಎಂಐ ಕಂತು",
    actions: "ಕ್ರಮಗಳು",
    approve: "ಅನುಮೋದಿಸಿ",
    reject: "ತಿರಸ್ಕರಿಸಿ",
    todaysSummary: "ಇಂದಿನ ಸಾರಾಂಶ",
    assignedCustomers: "ನಿಮಗೆ ನಿಯೋಜಿಸಲಾದ ಗ್ರಾಹಕರು",
    recentDeposits: "ಇತ್ತೀಚಿನ ಠೇವಣಿಗಳು",
    collectDailySavings: "ದೈನಂದಿನ ಉಳಿತಾಯ ಸಂಗ್ರಹಿಸಿ",
    confirmCollection: "ಸಂಗ್ರಹಣೆಯನ್ನು ಖಚಿತಪಡಿಸಿ",
    amountCollected: "ಸಂಗ್ರಹಿಸಿದ ಮೊತ್ತ (₹)",
    myPigmy: "ನನ್ನ ಪಿಗ್ಮಿ ಕ್ರಾಂತಿ",
    totalSavingsBalance: "ಒಟ್ಟು ಉಳಿತಾಯ ಬಾಕಿ",
    applyForLoan: "ಸಾಲಕ್ಕಾಗಿ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
    loanPending: "ಸಾಲ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    submitApplication: "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
    loanDetails: "ತಿಂಗಳಿಗೆ ಶೇಕಡಾ 2 ರಷ್ಟು ಪ್ರಮಾಣಿತ ಬಡ್ಡಿಯನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ.",
    profileNotFound: "ವಿವರಗಳು ಕಂಡುಬಂದಿಲ್ಲ",
    profileNotFoundDesc: "ನಿಮ್ಮ ಇಮೇಲ್ ಪಟ್ಟಿಯಲ್ಲಿ ನೋಂದಣಿಯಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆಪರೇಟರ್ ಸಂಪರ್ಕಿಸಿ.",
    todaysPlan: "ಇಂದಿನ ಯೋಜನೆ",
    myCustomers: "ನನ್ನ ಗ್ರಾಹಕರು",
    kannadaToggle: "ಕನ್ನಡ",
    englishToggle: "English",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem("fundcircle_lang") as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("fundcircle_lang", language);
  }, [language]);

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
