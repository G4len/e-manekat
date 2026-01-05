import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Loader2, Trash2, CheckCircle2, 
  ShieldCheck, LogOut, Upload, Eye, X, Plus, Share2, 
  Users, Tag, Lock, Coins
} from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
const getFirebaseConfig = () => {
  const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
  if (envConfig) return JSON.parse(envConfig);
  
  // Data dari input manual Anda sebagai cadangan
  return {
    apiKey: "AIzaSyDI154RFksZaAQ_aj8b4Tw3wtPkEcCtNAw",
    authDomain: "e-manekat.firebaseapp.com",
    projectId: "e-manekat",
    storageBucket: "e-manekat.firebasestorage.app",
    messagingSenderId: "375308824460",
    appId: "1:375308824460:web:bebbd8399d58b4cefeb0a9",
    measurementId: "G-468F3FEN1X"
  };
};

const firebaseConfig = getFirebaseConfig();
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || 'e-manekat-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [masterData, setMasterData] = useState({
    categories: ['Umum'],
    familyMembers: ['Admin'],
    minTransfer: 50000
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  
  // State untuk input master baru (Menggantikan getElementById)
  const [newCat, setNewCat] = useState('');
  const [newMem, setNewMem] = useState('');

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

    // Sinkronisasi Transaksi
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    });

    // Sinkronisasi Master Data
    const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubscribeMaster = onSnapshot(masterDocRef, (docSnap) => {
      if (docSnap.exists()) setMasterData(docSnap.data());
      else setDoc(masterDocRef, masterData);
    });

    return () => { unsubscribeTrans(); unsubscribeMaster(); };
  }, [user, role]);

  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === 'approved');
    const sim = approved.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const peng = approved.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return { total: sim - peng, simpanan: sim, pengeluaran: peng };
  }, [transactions]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') {
      setRole('admin'); setShowLoginModal(false); notify("Admin Terverifikasi", "success");
    } else notify("Akses Ditolak!");
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!formData.member || !formData.amount || !formData.proofImage) {
      return notify("Lengkapi Nama, Nominal, dan Foto Bukti!");
    }

    if (formData.type === 'simpanan' && Number(formData.amount) < masterData.minTransfer) {
      return notify(`Minimal simpanan Rp ${masterData.minTransfer.toLocaleString()}`);
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData, 
        amount: Number(formData.amount), 
        createdAt: new Date().toISOString(),
        userName: formData.member, 
        status: 'waiting' 
      });
      setFormData({ ...formData, amount: '', description: '', proofImage: null });
      notify("Data terkirim ke Admin", "success"); 
      setActiveTab('dashboard');
    } catch (err) { notify("Gagal simpan data"); } 
    finally { setIsSubmitting(false); }
  };

  const updateMaster = async (field, value, action = 'add') => {
    if (!value && action === 'add') return;
    const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add') {
        await updateDoc(masterDocRef, { [field]: arrayUnion(value) });
        field === 'categories' ? setNewCat('') : setNewMem('');
      } else if (action === 'remove') {
        await updateDoc(masterDocRef, { [field]: arrayRemove(value) });
      } else {
        await updateDoc(masterDocRef, { [field]: value });
      }
      notify("Berhasil diperbarui", "success");
    } catch (err) { notify("Gagal update master"); }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <ShieldCheck className="mx-auto mb-4 text-blue-600" size={64} />
          <h1 className="text-2xl font-black mb-6 italic tracking-tighter">E-MANEKAT</h1>
          <div className="space-y-3">
            <button onClick={() => setShowLoginModal(true)} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"><Lock size={18}/> Login Admin</button>
            <button onClick={() => setRole('user')} className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border-2 border-emerald-100 transition-transform active:scale-95">Masuk sebagai Keluarga</button>
          </div>
        </div>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form onSubmit={handleAdminLogin} className="bg-white p-6 rounded-3xl w-full max-w-sm">
              <h2 className="font-black text-center mb-4 uppercase text-slate-400 text-sm tracking-widest">Verifikasi Admin</h2>
              <input type="text" placeholder="Username" className="w-full p-4 bg-slate-50 border rounded-2xl mb-3 outline-none focus:ring-2 ring-blue-500" onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border rounded-2xl mb-4 outline-none focus:ring-2 ring-blue-500" onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
              <button className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold">LOGIN</button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-full mt-4 text-slate-400 text-xs font-bold uppercase">Batal</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 flex flex-col font-sans">
      {notification && <div className={`fixed top-4 right-4 p-4 rounded-2xl text-white font-bold shadow-2xl z-[60] ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{notification.message}</div>}
      
      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2 md:p-6 print:hidden">
        <div className="hidden md:block mb-10 text-center"><h1 className="text-xl font-black text-blue-600 italic">E-MANEKAT</h1><p className="text-[9px] font-bold text-slate-300 tracking-[0.3em]">PRO SYSTEM</p></div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Konfirmasi" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          {role === 'admin' && <NavItem icon={<Settings />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          <button onClick={() => setRole(null)} className="flex items-center gap-3 p-3 text-rose-500 font-bold mt-auto hover:bg-rose-50 rounded-xl transition-colors"><LogOut size={20}/> Logout</button>
        </div>
      </nav>

      <main className="p-4 md:p-8 flex-grow max-w-5xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Kas" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
              <StatCard label="Pemasukan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
              <StatCard label="Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
            </div>
            {/* Riwayat Dashboard */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Riwayat Terakhir</h3>
                <div className="divide-y">
                    {transactions.slice(0,5).map(t => (
                        <div key={t.id} className="py-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {t.type === 'simpanan' ? <ArrowUpCircle size={18}/> : <ArrowDownCircle size={18}/>}
                                </div>
                                <div><p className="font-bold text-sm text-slate-700">{t.description}</p><p className="text-[10px] font-bold text-slate-400 uppercase">{t.userName} • {t.date}</p></div>
                            </div>
                            <p className={`font-black text-sm ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'simpanan' ? '+' : '-'} {t.amount.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white p-6 md:p-10 rounded-3xl border shadow-sm max-w-2xl mx-auto">
            <h2 className="font-black text-xl mb-8 flex items-center gap-3 text-slate-700 uppercase">Input Transaksi</h2>
            <form onSubmit={handleSaveTransaction} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setFormData({...formData, type: 'simpanan'})} className={`p-5 rounded-2xl border-2 font-black transition-all ${formData.type === 'simpanan' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-50 text-slate-300 bg-slate-50'}`}>Pemasukan</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'pengeluaran'})} className={`p-5 rounded-2xl border-2 font-black transition-all ${formData.type === 'pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-50 text-slate-300 bg-slate-50'}`}>Pengeluaran</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none" value={formData.member} onChange={e => setFormData({...formData, member: e.target.value})}>
                    <option value="">-- Pilih Anggota --</option>
                    {masterData.familyMembers?.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">-- Kategori --</option>
                    {masterData.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input type="number" placeholder="Nominal Rp" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-3xl outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              <textarea placeholder="Keterangan transaksi..." className="w-full p-4 bg-slate-50 border-none rounded-2xl min-h-[120px] outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              
              <div className="border-2 border-dashed border-slate-200 p-8 rounded-3xl text-center bg-slate-50/30">
                <input type="file" hidden ref={fileInputRef} onChange={e => {
                  const reader = new FileReader();
                  reader.onload = () => setFormData({...formData, proofImage: reader.result});
                  reader.readAsDataURL(e.target.files[0]);
                }} />
                <button type="button" onClick={() => fileInputRef.current.click()} className="flex flex-col items-center mx-auto gap-2">
                  <Upload className={formData.proofImage ? "text-emerald-500" : "text-slate-300"} size={32} />
                  <span className="text-xs font-black uppercase tracking-widest">
                    {formData.proofImage ? "Foto Berhasil Terlampir ✅" : "Lampirkan Foto Bukti *"}
                  </span>
                </button>
              </div>
              <button disabled={isSubmitting} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl">
                {isSubmitting ? "MENGIRIM..." : "KIRIM DATA"}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6">
            <h2 className="font-black text-xl mb-6">PENGATURAN</h2>
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Coins size={14}/> Batas Minimal Simpanan</h3>
                <div className="flex gap-4">
                    <input type="number" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none" value={masterData.minTransfer} onChange={e => setMasterData({...masterData, minTransfer: Number(e.target.value)})} />
                    <button onClick={() => updateMaster('minTransfer', masterData.minTransfer, 'set')} className="bg-blue-600 text-white p-4 px-8 rounded-2xl font-bold">SIMPAN</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Tag size={14}/> Master Kategori</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Kategori baru..." className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none" />
                        <button onClick={() => updateMaster('categories', newCat)} className="bg-blue-600 text-white p-3 rounded-xl"><Plus size={18}/></button>
                    </div>
                    <div className="space-y-2">
                        {masterData.categories?.map(c => (
                            <div key={c} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm">{c} <button onClick={() => updateMaster('categories', c, 'remove')} className="text-rose-500"><Trash2 size={16}/></button></div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Users size={14}/> Anggota Keluarga</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" value={newMem} onChange={e => setNewMem(e.target.value)} placeholder="Nama baru..." className="flex-1 p-3 bg-slate-50 rounded-xl font-bold text-sm outline-none" />
                        <button onClick={() => updateMaster('familyMembers', newMem)} className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={18}/></button>
                    </div>
                    <div className="space-y-2">
                        {masterData.familyMembers?.map(m => (
                            <div key={m} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm">{m} <button onClick={() => updateMaster('familyMembers', m, 'remove')} className="text-rose-500"><Trash2 size={16}/></button></div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* Tab Approval dan Report tetap sama dengan penyesuaian stabilitas */}
        {activeTab === 'approval' && role === 'admin' && (
            <div className="space-y-4">
                <h3 className="font-black text-slate-400 uppercase text-xs tracking-widest mb-6">Menunggu Konfirmasi</h3>
                {transactions.filter(t => t.status === 'waiting').length === 0 ? <div className="text-center py-20 text-slate-300 font-bold">Tidak ada antrean</div> : 
                    transactions.filter(t => t.status === 'waiting').map(t => (
                        <div key={t.id} className="bg-white p-6 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full">
                                <div className={`p-4 rounded-2xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{t.type === 'simpanan' ? <ArrowUpCircle size={32}/> : <ArrowDownCircle size={32}/>}</div>
                                <div><h4 className="font-black text-slate-800">{t.description}</h4><p className="text-xs font-bold text-slate-400 uppercase">{t.userName} • Rp {t.amount.toLocaleString()}</p></div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={() => setViewImage(t.proofImage)} className="flex-1 md:flex-none p-3 bg-blue-50 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2"><Eye size={18}/> BUKTI</button>
                                <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'approved' })} className="flex-1 md:flex-none p-3 px-8 bg-emerald-600 text-white rounded-xl font-black">SAH</button>
                            </div>
                        </div>
                    ))
                }
            </div>
        )}

        {activeTab === 'report' && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                    <input type="date" className="p-3 bg-slate-50 rounded-xl text-xs font-bold" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} />
                    <input type="date" className="p-3 bg-slate-50 rounded-xl text-xs font-bold" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} />
                    <select className="p-3 bg-slate-50 rounded-xl text-xs font-bold" value={reportFilters.member} onChange={e => setReportFilters({...reportFilters, member: e.target.value})}>
                        <option value="">Semua Anggota</option>
                        {masterData.familyMembers?.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="flex-1 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"><Printer size={14}/> PRINT</button>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr className="border-b"><th className="p-5">Tanggal</th><th className="p-5">Nama</th><th className="p-5">Keterangan</th><th className="p-5 text-right">Nominal</th></tr></thead>
                        <tbody className="divide-y text-slate-600">
                            {transactions.filter(t => t.status === 'approved').map(t => (
                                <tr key={t.id}>
                                    <td className="p-5 font-bold opacity-50">{t.date}</td>
                                    <td className="p-5 font-black text-slate-700">{t.userName}</td>
                                    <td className="p-5">{t.description}</td>
                                    <td className={`p-5 text-right font-black ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </main>

      {/* Preview Image Modal */}
      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-3xl relative" onClick={e => e.stopPropagation()}>
             <img src={viewImage} className="w-full h-auto rounded-3xl p-2" alt="Proof" />
             <button onClick={() => setViewImage(null)} className="absolute -top-4 -right-4 bg-white p-3 rounded-full shadow-2xl"><X size={20}/></button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- SUBKOMPONEN ---
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400'}`}>
    {React.cloneElement(icon, { size: 22 })}
    <span className="text-[9px] md:text-sm uppercase font-bold tracking-tight">{label}</span>
    {badge > 0 && <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>}
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

export default App;
