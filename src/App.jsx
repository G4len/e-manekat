import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Trash2, CheckCircle2, 
  ShieldCheck, LogOut, X, Plus, Share2, Users, Tag, Lock, AlertCircle, Info, Filter, Calendar, BookOpen, Loader2, Eye
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
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !role) return;

    // Sync Transaksi
    const unsubTrans = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions')), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    });

    // Sync Master Data (Kunci utama agar fitur Settings jalan)
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      if (snap.exists()) {
        setMasterData(snap.data());
      } else {
        // Buat data default jika belum ada di database
        setDoc(masterRef, { categories: ['Umum'], familyMembers: ['Admin'], minTransfer: 50000 });
      }
    });

    return () => { unsubTrans(); unsubMaster(); };
  }, [user, role]);

  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === 'approved');
    const sim = approved.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const peng = approved.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return { total: sim - peng, simpanan: sim, pengeluaran: peng };
  }, [transactions]);

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
      } else {
        await updateDoc(masterRef, { [field]: value });
      }
      notify("Berhasil diperbarui", "success");
    } catch (err) { notify("Gagal memperbarui master"); }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!formData.member || !formData.amount || !formData.proofImage) return notify("Lengkapi data dan bukti foto!");
    if (formData.type === 'simpanan' && Number(formData.amount) < masterData.minTransfer) {
      return notify(`Minimal simpanan Rp ${masterData.minTransfer.toLocaleString()}`);
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData, amount: Number(formData.amount), createdAt: new Date().toISOString(),
        userId: user.uid, userName: formData.member, status: 'waiting' 
      });
      setFormData({ ...formData, amount: '', description: '', proofImage: null });
      notify("Pengajuan terkirim!", "success"); setActiveTab('dashboard');
    } catch (err) { notify("Gagal kirim"); } finally { setIsSubmitting(false); }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <ShieldCheck className="mx-auto text-blue-600 mb-4" size={50} />
          <h1 className="text-3xl font-black mb-6">E-MANEKAT</h1>
          <div className="space-y-4">
            <button onClick={() => setShowLoginModal(true)} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"><Lock size={18}/> LOGIN ADMIN</button>
            <button onClick={() => setRole('user')} className="w-full p-5 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border-2 border-emerald-100">MASUK KELUARGA</button>
          </div>
        </div>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400"><X/></button>
              <h2 className="text-xl font-black text-center mb-6 uppercase tracking-widest">Admin Portal</h2>
              <input type="text" placeholder="Username" className="w-full p-4 bg-slate-50 border rounded-2xl mb-3 outline-none focus:border-blue-500" onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border rounded-2xl mb-4 outline-none focus:border-blue-500" onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
              <button onClick={() => {
                if(loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') { setRole('admin'); setShowLoginModal(false); }
                else notify("Akses Ditolak!");
              }} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black">VERIFIKASI</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 flex flex-col font-sans">
      {notification && <div className={`fixed top-4 right-4 p-4 rounded-2xl text-white font-bold shadow-2xl z-[100] ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{notification.message}</div>}
      
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2 md:p-6 print:hidden">
        <div className="hidden md:block mb-10"><h1 className="text-2xl font-black text-blue-600">E-MANEKAT</h1></div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Konfirmasi" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          {role === 'admin' && <NavItem icon={<Settings />} label="Master" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          <button onClick={() => setRole(null)} className="flex items-center gap-3 p-3 text-rose-500 font-bold mt-auto"><LogOut size={20}/> Logout</button>
        </div>
      </nav>

      <main className="p-4 md:p-8 flex-grow max-w-5xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Saldo" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
              <StatCard label="Simpanan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
              <StatCard label="Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
            </div>
            <div className="bg-white rounded-3xl border shadow-sm divide-y">
              <div className="p-5 font-black text-xs text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-t-3xl">Riwayat Terakhir</div>
              {transactions.slice(0,5).map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{t.type==='simpanan' ? <ArrowUpCircle size={20}/> : <ArrowDownCircle size={20}/>}</div>
                    <div><p className="font-bold text-sm leading-none mb-1">{t.description}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{t.userName} • {t.status}</p></div>
                  </div>
                  <p className={`font-black ${t.type==='simpanan'?'text-emerald-600':'text-rose-600'}`}>Rp {t.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black">PENGATURAN MASTER</h2>
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Minimal Simpanan (Rp)</label>
                <div className="flex gap-3">
                    <input type="number" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none" value={masterData.minTransfer} onChange={e => setMasterData({...masterData, minTransfer: Number(e.target.value)})} />
                    <button onClick={() => handleUpdateMaster('minTransfer', masterData.minTransfer, 'set')} className="bg-blue-600 text-white px-8 rounded-2xl font-bold">UPDATE</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Tag size={14}/> Kategori</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Tambah..." />
                        <button onClick={() => handleUpdateMaster('categories', newCategory, 'add')} className="bg-blue-600 text-white p-3 rounded-xl"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {masterData.categories.map(c => (
                            <div key={c} className="flex justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm">{c} <button onClick={() => handleUpdateMaster('categories', c, 'remove')} className="text-rose-500"><Trash2 size={16}/></button></div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Users size={14}/> Anggota</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold" value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Tambah..." />
                        <button onClick={() => handleUpdateMaster('familyMembers', newMember, 'add')} className="bg-emerald-600 text-white p-3 rounded-xl"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {masterData.familyMembers.map(m => (
                            <div key={m} className="flex justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm">{m} <button onClick={() => handleUpdateMaster('familyMembers', m, 'remove')} className="text-rose-500"><Trash2 size={16}/></button></div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* Input, Report, Approval Tabs menggunakan struktur serupa dari backup Anda */}
        {activeTab === 'input' && (
          <div className="bg-white p-6 rounded-3xl border shadow-sm max-w-2xl mx-auto">
             {/* ... Copy dari file backup4.jsx bagian tab input ... */}
             <h3 className="text-xl font-black mb-6">TAMBAH TRANSAKSI</h3>
             <form onSubmit={handleSaveTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                   <button type="button" onClick={() => setFormData({...formData, type: 'simpanan'})} className={`p-4 rounded-xl border-2 font-black ${formData.type === 'simpanan' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-50 text-slate-300'}`}>Simpanan</button>
                   <button type="button" onClick={() => setFormData({...formData, type: 'pengeluaran'})} className={`p-4 rounded-xl border-2 font-black ${formData.type === 'pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-50 text-slate-300'}`}>Pengeluaran</button>
                </div>
                <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={formData.member} onChange={e => setFormData({...formData, member: e.target.value})}>
                    <option value="">Pilih Anggota</option>
                    {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="number" placeholder="Nominal Rp" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-2xl" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                <div className="border-2 border-dashed p-6 rounded-2xl text-center cursor-pointer bg-slate-50" onClick={() => fileInputRef.current.click()}>
                   <input type="file" hidden ref={fileInputRef} onChange={e => {
                     const reader = new FileReader();
                     reader.onload = () => setFormData({...formData, proofImage: reader.result});
                     reader.readAsDataURL(e.target.files[0]);
                   }} />
                   {formData.proofImage ? "✅ Foto Dimuat" : "📸 Upload Bukti *"}
                </div>
                <button disabled={isSubmitting} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black shadow-lg">{isSubmitting ? "PROSES..." : "KIRIM PENGAJUAN"}</button>
             </form>
          </div>
        )}
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon}
    <span className="text-[10px] md:text-sm uppercase font-bold">{label}</span>
    {badge > 0 && <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{badge}</span>}
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
