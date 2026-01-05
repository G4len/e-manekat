import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Settings, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  Printer, 
  Loader2,
  Trash2,
  CheckCircle2,
  UserCircle,
  ShieldCheck,
  LogOut,
  Upload,
  Eye,
  X,
  Plus,
  Share2,
  Users,
  Tag,
  Lock,
  AlertCircle,
  Info,
  Filter,
  Calendar,
  Coins,
  BookOpen
} from 'lucide-react';

/**
 * Konfigurasi Firebase dari Environment Variables Vercel
 */
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
    startDate: '',
    endDate: '',
    member: '',
    type: ''
  });

  const [formData, setFormData] = useState({
    type: 'simpanan',
    amount: '',
    description: '',
    category: '',
    member: '',
    date: new Date().toISOString().split('T')[0],
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
        if (!formData.category && data.categories) setFormData(prev => ({ ...prev, category: data.categories[0] || '' }));
        if (!formData.member && data.familyMembers) setFormData(prev => ({ ...prev, member: data.familyMembers[0] || '' }));
      } else {
        setDoc(masterDoc, masterData);
      }
    });

    return () => {
      unsubscribeTrans();
      unsubscribeMaster();
    };
  }, [user, role]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isApproved = t.status === 'approved';
      const matchStart = !reportFilters.startDate || t.date >= reportFilters.startDate;
      const matchEnd = !reportFilters.endDate || t.date <= reportFilters.endDate;
      const matchMember = !reportFilters.member || t.userName === reportFilters.member;
      const matchType = !reportFilters.type || t.type === reportFilters.type;
      return isApproved && matchStart && matchEnd && matchMember && matchType;
    });
  }, [transactions, reportFilters]);

  const stats = useMemo(() => {
    const approvedOnly = transactions.filter(t => t.status === 'approved');
    const totalSimpanan = approvedOnly.filter(t => t.type === 'simpanan').reduce((sum, t) => sum + Number(t.amount), 0);
    const totalPengeluaran = approvedOnly.filter(t => t.type === 'pengeluaran').reduce((sum, t) => sum + Number(t.amount), 0);
    return { total: totalSimpanan - totalPengeluaran, simpanan: totalSimpanan, pengeluaran: totalPengeluaran };
  }, [transactions]);

  const filteredStats = useMemo(() => {
    const sim = filteredTransactions.filter(t => t.type === 'simpanan').reduce((sum, t) => sum + Number(t.amount), 0);
    const peng = filteredTransactions.filter(t => t.type === 'pengeluaran').reduce((sum, t) => sum + Number(t.amount), 0);
    return { sim, peng, diff: sim - peng };
  }, [filteredTransactions]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') {
      setRole('admin');
      setShowLoginModal(false);
      setLoginCreds({ username: '', password: '' });
      notify("Berhasil masuk sebagai Admin", "success");
    } else {
      notify("Username atau Password salah!");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { 
        notify("Ukuran gambar terlalu besar. Maksimal 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, proofImage: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    if (!formData.member || !formData.amount || !formData.proofImage) return notify("Lengkapi data dan bukti foto!");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData,
        amount: Number(formData.amount),
        createdAt: new Date().toISOString(),
        userId: user.uid,
        userName: formData.member,
        status: 'waiting' 
      });
      setFormData(prev => ({ ...prev, amount: '', description: '', proofImage: null }));
      notify("Pengajuan berhasil dikirim!", "success");
      setActiveTab('dashboard');
    } catch (err) {
      notify("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMaster = async (field, value, action = 'add') => {
    const masterDoc = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add') await updateDoc(masterDoc, { [field]: arrayUnion(value) });
      else if (action === 'remove') await updateDoc(masterDoc, { [field]: arrayRemove(value) });
      else await updateDoc(masterDoc, { [field]: value });
      notify("Data diperbarui", "success");
    } catch (err) {
      notify("Gagal memperbarui data master");
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        {notification && <div className="fixed top-6 bg-rose-600 text-white p-4 rounded-2xl shadow-xl font-bold text-sm">{notification.message}</div>}
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"><ShieldCheck className="text-white w-10 h-10" /></div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">E-MANEKAT</h1>
          <p className="text-slate-500 mb-8 font-medium text-sm">Dana Kas Keluarga Terintegrasi</p>
          <div className="space-y-4">
            <button onClick={() => setShowLoginModal(true)} className="w-full flex items-center gap-4 p-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg font-bold">
              <ShieldCheck size={24} /> Login Admin
            </button>
            <button onClick={() => setRole('user')} className="w-full flex items-center gap-4 p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-emerald-900 font-bold">
              <UserCircle size={24} /> Login Keluarga
            </button>
          </div>
        </div>

        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form onSubmit={handleAdminLogin} className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative">
              <button type="button" onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
              <h2 className="text-xl font-black text-center mb-6 uppercase">Admin Portal</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Username" required className="w-full p-4 bg-slate-50 border rounded-xl outline-none" value={loginCreds.username} onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
                <input type="password" placeholder="Password" required className="w-full p-4 bg-slate-50 border rounded-xl outline-none" value={loginCreds.password} onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
                <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">VERIFIKASI</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0 md:pl-64 text-slate-900 flex flex-col font-sans">
      <nav className="print:hidden fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:flex-col md:border-r z-40 flex md:p-6 justify-around p-2">
        <div className="hidden md:block mb-10 text-center">
          <h1 className="text-2xl font-black text-blue-700">E-MANEKAT</h1>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Family Finance</p>
        </div>
        <div className="flex md:flex-col w-full md:gap-2">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Konfirmasi" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          <NavItem icon={<BookOpen />} label="Panduan" active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} />
          {role === 'admin' && <NavItem icon={<Settings />} label="Master" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          <button onClick={() => { setRole(null); setActiveTab('dashboard'); }} className="flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 rounded-2xl text-rose-500 mt-auto hover:bg-rose-50">
            <LogOut size={22} /><span className="text-[10px] md:text-sm font-bold uppercase">Logout</span>
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-5xl mx-auto w-full flex-grow">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Kas" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
              <StatCard label="Total Simpanan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
              <StatCard label="Total Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b bg-slate-50/50"><h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Riwayat Terakhir</h3></div>
              <div className="divide-y">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'simpanan' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-700">{t.description}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{t.date} • {t.userName}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'simpanan' ? '+' : '-'} {t.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white rounded-3xl border p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-black mb-6">Tambah Transaksi</h3>
            <form onSubmit={handleSaveTransaction} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setFormData({...formData, type: 'simpanan'})} className={`p-4 rounded-2xl border-2 font-bold ${formData.type === 'simpanan' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-300'}`}>Simpanan</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'pengeluaran'})} className={`p-4 rounded-2xl border-2 font-bold ${formData.type === 'pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-100 text-slate-300'}`}>Pengeluaran</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <select required value={formData.member} onChange={e => setFormData({...formData, member: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                  <option value="">-- Nama Anggota --</option>
                  {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div onClick={() => fileInputRef.current.click()} className="h-[58px] border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer text-xs font-bold text-slate-400 uppercase">
                  <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                  {formData.proofImage ? "Bukti Terlampir ✅" : "Upload Bukti 📸"}
                </div>
              </div>
              <input type="number" required placeholder="Nominal (Rp)" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-2xl" />
              <textarea required placeholder="Keterangan..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl min-h-[100px]" />
              <button disabled={isSubmitting} className="w-full bg-blue-600 text-white font-black p-5 rounded-2xl shadow-xl uppercase tracking-widest">{isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}</button>
            </form>
          </div>
        )}

        {activeTab === 'approval' && role === 'admin' && (
          <div className="space-y-4">
            <h3 className="text-xl font-black mb-6 uppercase">Konfirmasi Transaksi</h3>
            {transactions.filter(t => t.status === 'waiting').length === 0 ? <p className="text-center text-slate-400 font-bold p-10">Tidak ada antrian.</p> : 
              transactions.filter(t => t.status === 'waiting').map(t => (
                <div key={t.id} className="bg-white p-5 rounded-3xl border flex items-center justify-between shadow-sm">
                  <div>
                    <h4 className="font-black text-slate-700">{t.description}</h4>
                    <p className="text-xs text-slate-500 font-bold">{t.userName} • Rp {t.amount.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewImage(t.proofImage)} className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Eye size={18}/></button>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'approved' })} className="p-3 px-6 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">Setujui</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === 'report' && (
           <div className="bg-white rounded-3xl border overflow-hidden shadow-sm printable-area p-6">
              <h3 className="text-xl font-black mb-6 uppercase flex items-center justify-between">
                Laporan Kas 
                <button onClick={() => window.print()} className="bg-blue-600 text-white p-2 px-4 rounded-xl text-xs print:hidden"><Printer size={16}/></button>
              </h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                  <tr><th className="p-4 border-b">Tanggal</th><th className="p-4 border-b">Nama</th><th className="p-4 border-b">Keterangan</th><th className="p-4 border-b text-right">Nominal</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransactions.map(t => (
                    <tr key={t.id}><td className="p-4 opacity-60">{t.date}</td><td className="p-4 font-bold">{t.userName}</td><td className="p-4">{t.description}</td><td className={`p-4 text-right font-black ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.amount.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
           </div>
        )}

        {/* --- FOOTER MULAI DI SINI --- */}
        <footer className="mt-12 pb-6 text-center print:hidden">
          <div className="pt-6 border-t border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              © 2026 Galen Adonai Piandi Banunu
            </p>
            <p className="text-[8px] font-bold text-slate-300 mt-1 uppercase">
              E-Manekat Pro • Family Finance System
            </p>
          </div>
        </footer>
        {/* --- FOOTER SELESAI --- */}

      </main>

      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-3xl overflow-hidden relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewImage(null)} className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full"><X size={24}/></button>
            <img src={viewImage} className="w-full h-auto p-2" alt="Proof" />
          </div>
        </div>
      )}

      <style>{`
        @media print { 
          nav, button, footer, .print\\:hidden { display: none !important; } 
          body { background: white !important; margin: 0 !important; color: black !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; } 
          .md\\:pl-64 { padding-left: 0 !important; }
        }
      `}</style>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400'}`}>
    {React.cloneElement(icon, { size: 22 })}
    <span className="text-[10px] md:text-sm uppercase tracking-tight">{label}</span>
    {badge > 0 && <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border flex items-center gap-4 shadow-sm">
    <div className={`p-4 rounded-2xl ${color} text-white shadow-lg`}>{icon}</div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <h2 className="text-xl font-black text-slate-800 tracking-tighter truncate">Rp {value.toLocaleString()}</h2>
    </div>
  </div>
);

export default App;
