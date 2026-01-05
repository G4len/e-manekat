import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Loader2, Trash2, CheckCircle2, 
  UserCircle, ShieldCheck, LogOut, Upload, Eye, X, Plus, Share2, 
  Users, Tag, Lock, AlertCircle, Info, Filter, Calendar, Coins, BookOpen
} from 'lucide-react';

// Firebase Config
const getFirebaseConfig = () => {
  let config = {};
  try {
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    if (envConfig) config = JSON.parse(envConfig);
  } catch (e) { console.error("Firebase Config Error:", e); }
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
  const [masterData, setMasterData] = useState({ categories: [], familyMembers: [], minTransfer: 50000 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newMember, setNewMember] = useState('');
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '', member: '', type: '' });
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
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !role) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    });

    const masterDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubscribeMaster = onSnapshot(masterDoc, (docSnap) => {
      if (docSnap.exists()) setMasterData(docSnap.data());
      else setDoc(masterDoc, { categories: ['Umum'], familyMembers: ['Admin'], minTransfer: 50000 });
    });
    return () => { unsubscribeTrans(); unsubscribeMaster(); };
  }, [user, role]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isApproved = t.status === 'approved';
      const matchStart = !reportFilters.startDate || t.date >= reportFilters.startDate;
      const matchEnd = !reportFilters.endDate || t.date <= reportFilters.endDate;
      const matchMember = !reportFilters.member || t.userName === reportFilters.member;
      return isApproved && matchStart && matchEnd && matchMember;
    });
  }, [transactions, reportFilters]);

  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === 'approved');
    const simpanan = approved.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const pengeluaran = approved.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return { total: simpanan - pengeluaran, simpanan, pengeluaran };
  }, [transactions]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') {
      setRole('admin'); setShowLoginModal(false); notify("Admin Terverifikasi", "success");
    } else notify("Akses Ditolak!");
  };

  const updateMaster = async (field, value, action = 'add') => {
    const masterDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add') await updateDoc(masterDoc, { [field]: arrayUnion(value) });
      else if (action === 'remove') await updateDoc(masterDoc, { [field]: arrayRemove(value) });
      else await updateDoc(masterDoc, { [field]: value });
      notify("Berhasil diperbarui", "success");
    } catch (err) { notify("Gagal update"); }
  };

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 flex flex-col font-sans">
      {/* NOTIFICATION UI */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-2xl text-white font-bold shadow-2xl z-[100] ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {notification.message}
        </div>
      )}
      
      {/* NAVIGATION */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2 md:p-6 print:hidden">
        <div className="hidden md:block mb-10"><h1 className="text-xl font-black text-blue-600 italic">E-MANEKAT</h1></div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Konfirmasi" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          {role === 'admin' && <NavItem icon={<Settings />} label="Master" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          <button onClick={() => setRole(null)} className="flex items-center gap-3 p-3 text-rose-500 font-bold mt-auto"><LogOut size={20}/> Logout</button>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="p-4 md:p-8 flex-grow max-w-5xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Kas" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
            <StatCard label="Simpanan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
            <StatCard label="Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
          </div>
        )}

        {/* --- MENU SETTINGS MASTER --- */}
        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Batas Minimal Simpanan</h3>
                <div className="flex gap-2">
                    <input type="number" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none" value={masterData.minTransfer} onChange={e => setMasterData({...masterData, minTransfer: Number(e.target.value)})} />
                    <button onClick={() => updateMaster('minTransfer', masterData.minTransfer, 'set')} className="bg-blue-600 text-white px-8 rounded-2xl font-bold">SIMPAN</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Kategori</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" placeholder="Kategori baru..." className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                        <button onClick={() => { if(newCategory) { updateMaster('categories', newCategory); setNewCategory(''); } }} className="bg-blue-600 text-white p-3 rounded-xl"><Plus size={18}/></button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {masterData.categories.map(c => (
                            <div key={c} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl font-bold text-xs">{c} <button onClick={() => updateMaster('categories', c, 'remove')} className="text-rose-500"><Trash2 size={14}/></button></div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Anggota Keluarga</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" placeholder="Nama baru..." className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" value={newMember} onChange={e => setNewMember(e.target.value)} />
                        <button onClick={() => { if(newMember) { updateMaster('familyMembers', newMember); setNewMember(''); } }} className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={18}/></button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {masterData.familyMembers.map(m => (
                            <div key={m} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl font-bold text-xs">{m} <button onClick={() => updateMaster('familyMembers', m, 'remove')} className="text-rose-500"><Trash2 size={14}/></button></div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* ... (Halaman lainnya: Input, Report, Approval tetap sama strukturnya) ... */}

        <footer className="mt-12 pb-10 text-center print:hidden">
          <div className="pt-8 border-t border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">© 2026 Galen Adonai Piandi Banunu</p>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-loose">E-Manekat Pro System • Secure Family Finance Solution</p>
          </div>
        </footer>
      </main>

      {/* MODAL IMAGE VIEW */}
      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-3xl relative" onClick={e => e.stopPropagation()}>
             <img src={viewImage} className="w-full h-auto rounded-3xl p-2" alt="Proof" />
             <button onClick={() => setViewImage(null)} className="absolute -top-4 -right-4 bg-white p-3 rounded-full shadow-2xl font-black"><X size={20}/></button>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAdminLogin} className="bg-white p-6 rounded-3xl w-full max-w-sm">
            <h2 className="font-black text-center mb-4 uppercase text-slate-400 text-xs tracking-widest">Verifikasi Admin</h2>
            <input type="text" placeholder="Username" className="w-full p-4 bg-slate-50 border rounded-2xl mb-3 outline-none" onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
            <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border rounded-2xl mb-4 outline-none" onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
            <button className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase">Masuk</button>
            <button type="button" onClick={() => setShowLoginModal(false)} className="w-full mt-4 text-slate-400 text-xs font-black uppercase underline">Batal</button>
          </form>
        </div>
      )}

      <style>{`
        @media print { 
          nav, button, footer, .print\\:hidden { display: none !important; } 
          body { background: white !important; margin: 0 !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; } 
          .md\\:pl-64 { padding-left: 0 !important; }
        }
      `}</style>
    </div>
  );
};

// COMPONENT HELPER (PENTING: Jangan taruh di dalam function App)
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400'}`}>
    {icon}
    <span className="text-[9px] md:text-sm uppercase font-bold">{label}</span>
    {badge > 0 && <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border flex items-center gap-4 shadow-sm">
    <div className={`p-4 rounded-2xl ${color} text-white shadow-xl`}>{icon}</div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h2 className="text-xl font-black text-slate-800 truncate">Rp {value.toLocaleString()}</h2>
    </div>
  </div>
);

export default App; // BARIS 809 (TUTUP DENGAN BENAR)
