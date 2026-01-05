import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Loader2, Trash2, CheckCircle2, 
  UserCircle, ShieldCheck, LogOut, Upload, Eye, X, Plus, Share2, 
  Users, Tag, Lock, AlertCircle, Info, Filter, Calendar, Coins
} from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
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
  
  // Master Data State
  const [masterData, setMasterData] = useState({ 
    categories: [], 
    familyMembers: [], 
    minTransfer: 50000 
  });
  
  const [notification, setNotification] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [newMember, setNewMember] = useState('');

  const notify = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, setUser);
  }, []);

  // --- LOGIKA SYNC MASTER DATA (PERBAIKAN UTAMA) ---
  useEffect(() => {
    if (!user || !role) return;

    // Ambil Transaksi
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
    const unsubTrans = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Ambil & Inisialisasi Master Data
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    
    const unsubMaster = onSnapshot(masterRef, async (docSnap) => {
      if (docSnap.exists()) {
        setMasterData(docSnap.data());
      } else {
        // Jika dokumen "master" belum ada di Firestore, buatkan otomatis
        const initialData = { 
          categories: ['Umum', 'Simpanan Wajib'], 
          familyMembers: ['Admin'], 
          minTransfer: 50000 
        };
        await setDoc(masterRef, initialData);
        setMasterData(initialData);
      }
    });

    return () => { unsubTrans(); unsubMaster(); };
  }, [user, role]);

  // --- FUNGSI UPDATE MASTER (TAMBAH/HAPUS) ---
  const handleUpdateMaster = async (field, value, action = 'add') => {
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    
    try {
      if (action === 'add') {
        if (!value.trim()) return notify("Input tidak boleh kosong");
        await updateDoc(masterRef, { [field]: arrayUnion(value) });
        if (field === 'categories') setNewCategory('');
        if (field === 'familyMembers') setNewMember('');
      } else if (action === 'remove') {
        await updateDoc(masterRef, { [field]: arrayRemove(value) });
      } else if (action === 'set') {
        await updateDoc(masterRef, { [field]: value });
      }
      notify("Data Master diperbarui", "success");
    } catch (err) {
      console.error(err);
      notify("Gagal update. Pastikan koneksi stabil.");
    }
  };

  // UI login, dashboard, dll tetap sama, fokus ke tampilan Settings bawah ini:
  if (!role) return <LoginScreen onLogin={(r) => setRole(r)} notify={notify} />;

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 flex flex-col">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-xl text-white font-bold z-[100] animate-bounce ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {notification.message}
        </div>
      )}

      {/* Sidebar Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2">
         {/* ... (Nav items sama seperti sebelumnya) */}
         <button onClick={() => setActiveTab('settings')} className={`flex-1 p-3 rounded-xl flex flex-col items-center md:flex-row md:gap-3 ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
            <Settings size={20}/> <span className="text-[10px] md:text-sm font-bold uppercase">Master</span>
         </button>
      </nav>

      <main className="p-4 md:p-8 max-w-5xl w-full mx-auto">
        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6">
            <h2 className="font-black text-2xl text-slate-800 mb-6">PENGATURAN MASTER</h2>

            {/* MINIMAL NOMINAL */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Minimal Simpanan (Rp)</label>
                <div className="flex gap-3">
                    <input type="number" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-blue-500" value={masterData.minTransfer} onChange={e => setMasterData({...masterData, minTransfer: Number(e.target.value)})} />
                    <button onClick={() => handleUpdateMaster('minTransfer', masterData.minTransfer, 'set')} className="bg-blue-600 text-white px-8 rounded-2xl font-black">UPDATE</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MASTER KATEGORI */}
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-sm font-black text-slate-700 uppercase mb-4 flex items-center gap-2"><Tag size={16}/> Kategori Transaksi</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" placeholder="Nama kategori..." className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                        <button onClick={() => handleUpdateMaster('categories', newCategory, 'add')} className="bg-blue-600 text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-transform"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {masterData.categories.map((cat) => (
                            <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors">
                                <span className="font-bold text-slate-600 text-sm">{cat}</span>
                                <button onClick={() => handleUpdateMaster('categories', cat, 'remove')} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MASTER ANGGOTA */}
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-sm font-black text-slate-700 uppercase mb-4 flex items-center gap-2"><Users size={16}/> Anggota Keluarga</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" placeholder="Nama anggota..." className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold text-sm" value={newMember} onChange={e => setNewMember(e.target.value)} />
                        <button onClick={() => handleUpdateMaster('familyMembers', newMember, 'add')} className="bg-emerald-600 text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-transform"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {masterData.familyMembers.map((mem) => (
                            <div key={mem} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors">
                                <span className="font-bold text-slate-600 text-sm">{mem}</span>
                                <button onClick={() => handleUpdateMaster('familyMembers', mem, 'remove')} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}
        {/* ... (Tab lainnya) */}
      </main>
    </div>
  );
};

// ... (Komponen StatCard, NavItem, LoginScreen di sini)

export default App;
