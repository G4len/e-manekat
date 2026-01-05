import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Download, Image as ImageIcon,
  Loader2, Trash2, CheckCircle2, XCircle, Clock, UserCircle, 
  ShieldCheck, LogOut, Upload, Eye, X, Plus, Share2, Users, 
  Tag, Lock, AlertCircle, Info, Filter, Calendar, FileDown, 
  Coins, BookOpen 
} from 'lucide-react';

// Penanganan konfigurasi Firebase yang kompatibel dengan Vercel (Vite)
const getFirebaseConfig = () => {
  let config = {};
  try {
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    if (envConfig) {
      config = JSON.parse(envConfig);
    }
  } catch (e) {
    console.error("Gagal parse konfigurasi Firebase:", e);
  }
  return config;
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = import.meta.env.VITE_APP_ID || 'e-manekat-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [masterData, setMasterData] = useState({
    categories: ['Umum', 'Pendidikan', 'Kesehatan', 'Rumah Tangga'],
    familyMembers: ['Ayah', 'Ibu'],
    minTransfer: 50000
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });

  const [reportFilters, setReportFilters] = useState({
    startDate: '', endDate: '', member: '', type: ''
  });

  const [formData, setFormData] = useState({
    type: 'simpanan', amount: '', description: '', 
    category: '', member: '', date: new Date().toISOString().split('T')[0],
    proofImage: null
  });

  const fileInputRef = useRef(null);

  const notify = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !role) return;

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setIsLoading(false);
    });

    const masterDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubscribeMaster = onSnapshot(masterDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMasterData(data);
      } else {
        setDoc(masterDoc, masterData);
      }
    });

    return () => {
      unsubscribeTrans();
      unsubscribeMaster();
    };
  }, [user, role]);

  // ... (Logika handleAdminLogin, handleSaveTransaction, dll sama seperti di backup4.jsx) ...
  // [Kode UI Navigasi, Dashboard, Input, Laporan, dll sesuai file asli Anda]

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0 md:pl-64 text-slate-900 flex flex-col font-sans">
      {/* Seluruh elemen UI dari backup4.jsx */}
      <nav className="print:hidden fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:flex-col md:border-r z-40 flex md:p-6 justify-around p-2">
        {/* Konten Navigasi */}
      </nav>
      {/* Konten Main sesuai tab aktif */}
    </div>
  );
};

// Sertakan Sub-komponen (NavItem, StatCard, GuideSection, StatusBadge, TypeButton) di bawah App
export default App;
