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

    // Ambil Transaksi & Urutkan berdasarkan Tanggal Terbaru
    const unsubTrans = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions')), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    });

    // Ambil Data Master
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      if (snap.exists()) {
        setMasterData(snap.data());
      } else {
        setDoc(masterRef, { categories: ['Umum'], familyMembers: ['Admin'], minTransfer: 50000 });
      }
    });

    return () => { unsubTrans(); unsubMaster(); };
  }, [user, role]);

  // Perbaikan Statistik Saldo
  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === 'approved');
    const sim = approved.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const peng = approved.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return { total: sim - peng, simpanan: sim, pengeluaran: peng };
  }, [transactions]);

  // Perbaikan Filter Laporan
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
    if (!formData.member || !formData.amount || !formData.category || !formData.proofImage) {
      return notify("Lengkapi semua data dan bukti foto!");
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
        userId: user.uid, 
        userName: formData.member, 
        status: 'waiting' 
      });
      setFormData({ ...formData, amount: '', description: '', proofImage: null });
      notify("Pengajuan terkirim!", "success"); 
      setActiveTab('dashboard');
    } catch (err) { 
      notify("Gagal mengirim data."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <ShieldCheck className="mx-auto text-blue-600 mb-4" size={50} />
          <h1 className="text-3xl font-black mb-6">E-MANEKAT</h1>
          <div className="space-y-4">
            <button onClick={() => setShowLoginModal(true)} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"><Lock size={18}/> LOGIN ADMIN</button>
            <button onClick={() => setRole('user')} className="w-full p-5 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border-2 border-emerald-100 uppercase tracking-widest">Masuk Keluarga</button>
          </div>
        </div>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400"><X/></button>
              <h2 className="text-xl font-black text-center mb-6 uppercase tracking-widest text-slate-700">Admin Portal</h2>
              <input type="text" placeholder="Username" className="w-full p-4 bg-slate-50 border rounded-2xl mb-3 outline-none focus:border-blue-500 font-bold" onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border rounded-2xl mb-4 outline-none focus:border-blue-500 font-bold" onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
              <button onClick={() => {
                if(loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') { setRole('admin'); setShowLoginModal(false); }
                else notify("Username/Password Salah!");
              }} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black shadow-lg">VERIFIKASI</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 flex flex-col font-sans">
      {notification && <div className={`fixed top-4 right-4 p-4 px-6 rounded-2xl text-white font-bold shadow-2xl z-[100] animate-bounce ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{notification.message}</div>}
      
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2 md:p-6 print:hidden shadow-lg md:shadow-none">
        <div className="hidden md:block mb-10 text-center"><h1 className="text-2xl font-black text-blue-600">E-MANEKAT</h1><p className="text-[9px] font-black text-slate-400 tracking-tighter">KEUANGAN KELUARGA</p></div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Antrean" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          {role === 'admin' && <NavItem icon={<Settings />} label="Master" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />}
          <button onClick={() => {setRole(null); setActiveTab('dashboard');}} className="flex items-center justify-center md:justify-start gap-3 p-3 text-rose-500 font-bold mt-auto hover:bg-rose-50 rounded-xl transition-colors"><LogOut size={20}/><span className="hidden md:block">Logout</span></button>
        </div>
      </nav>

      <main className="p-4 md:p-8 flex-grow max-w-5xl w-full mx-auto mb-20 md:mb-0">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Saldo" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
              <StatCard label="Simpanan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
              <StatCard label="Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
            </div>
            <div className="bg-white rounded-3xl border shadow-sm divide-y">
              <div className="p-5 font-black text-xs text-slate-400 uppercase tracking-widest bg-slate-50/50 rounded-t-3xl">Riwayat Transaksi Terbaru</div>
              {transactions.length === 0 ? <p className="p-10 text-center text-slate-400 font-bold italic">Belum ada transaksi</p> : 
                transactions.slice(0,8).map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{t.type==='simpanan' ? <ArrowUpCircle size={20}/> : <ArrowDownCircle size={20}/>}</div>
                      <div>
                        <div className="flex items-center gap-2"><p className="font-bold text-sm leading-none">{t.description}</p><StatusBadge status={t.status} /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{t.userName} • {t.date}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${t.type==='simpanan'?'text-emerald-600':'text-rose-600'}`}>{t.type==='simpanan'?'+':'-'} {t.amount.toLocaleString()}</p>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm max-w-2xl mx-auto">
             <h3 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800"><PlusCircle className="text-blue-600" /> TAMBAH TRANSAKSI</h3>
             <form onSubmit={handleSaveTransaction} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                   <button type="button" onClick={() => setFormData({...formData, type: 'simpanan'})} className={`p-4 rounded-2xl border-2 font-black transition-all ${formData.type === 'simpanan' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>Simpanan</button>
                   <button type="button" onClick={() => setFormData({...formData, type: 'pengeluaran'})} className={`p-4 rounded-2xl border-2 font-black transition-all ${formData.type === 'pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>Pengeluaran</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Anggota Keluarga</label>
                    <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-blue-500" value={formData.member} onChange={e => setFormData({...formData, member: e.target.value})}>
                        <option value="">-- Pilih Nama --</option>
                        {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Kategori</label>
                    <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:border-blue-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        <option value="">-- Pilih Kategori --</option>
                        {masterData.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nominal (Rp)</label>
                  <input type="number" placeholder="Contoh: 100000" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-2xl outline-none focus:border-blue-500" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Keterangan</label>
                  <textarea placeholder="Tulis catatan di sini..." className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none min-h-[100px]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Bukti Transaksi *</label>
                  <div className="border-2 border-dashed p-6 rounded-2xl text-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors" onClick={() => fileInputRef.current.click()}>
                    <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={e => {
                      const file = e.target.files[0];
                      if(file) {
                        const reader = new FileReader();
                        reader.onload = () => setFormData({...formData, proofImage: reader.result});
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {formData.proofImage ? <div className="flex flex-col items-center gap-2 text-emerald-600 font-bold"><CheckCircle2 /><span>Foto Berhasil Dimuat</span></div> : <div className="flex flex-col items-center gap-2 text-slate-400 font-bold"><Plus /><span>Klik untuk Upload Bukti</span></div>}
                  </div>
                </div>
                <button disabled={isSubmitting} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "KIRIM PENGAJUAN"}
                </button>
             </form>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border shadow-sm grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
              <input type="date" className="p-3 bg-slate-50 rounded-xl border text-xs font-bold" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} />
              <input type="date" className="p-3 bg-slate-50 rounded-xl border text-xs font-bold" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} />
              <select className="p-3 bg-slate-50 rounded-xl border text-xs font-bold" value={reportFilters.member} onChange={e => setReportFilters({...reportFilters, member: e.target.value})}>
                <option value="">Semua Anggota</option>
                {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={() => window.print()} className="bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs"><Printer size={16}/> CETAK</button>
            </div>
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden printable-area">
              <div className="p-6 border-b bg-slate-50/30 flex justify-between items-center">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Pratinjau Laporan</h3>
                <div className="text-right"><p className="text-[10px] font-bold text-slate-400">TOTAL SALDO TERFILTER</p><p className="font-black text-blue-600">Rp {filteredTransactions.reduce((acc, t) => t.type === 'simpanan' ? acc + t.amount : acc - t.amount, 0).toLocaleString()}</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                    <tr><th className="p-4">Tanggal</th><th className="p-4">Nama</th><th className="p-4">Keterangan</th><th className="p-4 text-right">Nominal</th></tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-slate-500">{t.date}</td>
                        <td className="p-4 font-black text-slate-800">{t.userName}</td>
                        <td className="p-4"><div><p className="font-bold">{t.description}</p><span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded font-black text-slate-400 uppercase">{t.category}</span></div></td>
                        <td className={`p-4 text-right font-black ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type==='simpanan'?'+':'-'} {t.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approval' && role === 'admin' && (
          <div className="space-y-4">
            <h3 className="text-xl font-black mb-6 uppercase tracking-widest text-slate-700 flex items-center gap-2"><Clock /> Antrean Persetujuan</h3>
            {transactions.filter(t => t.status === 'waiting').length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed text-center flex flex-col items-center gap-4">
                <CheckCircle2 size={48} className="text-slate-200" />
                <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">Semua pengajuan sudah diproses</p>
              </div>
            ) : (
              transactions.filter(t => t.status === 'waiting').map(t => (
                <div key={t.id} className="bg-white p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${t.type === 'simpanan' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === 'simpanan' ? <ArrowUpCircle size={32}/> : <ArrowDownCircle size={32}/>}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-700">{t.description}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase">{t.userName} • Rp {t.amount.toLocaleString()} • {t.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewImage(t.proofImage)} className="p-3 px-6 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 flex items-center gap-2 transition-colors"><Eye size={16}/> BUKTI</button>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'rejected' })} className="p-3 px-6 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-colors">TOLAK</button>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'approved' })} className="p-3 px-6 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition-colors">SETUJUI</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black flex items-center gap-2"><Settings className="text-blue-600" /> PENGATURAN MASTER</h2>
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Batas Minimal Simpanan (Rp)</label>
                <div className="flex gap-3">
                    <input type="number" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none focus:border-blue-500 border" value={masterData.minTransfer} onChange={e => setMasterData({...masterData, minTransfer: Number(e.target.value)})} />
                    <button onClick={() => handleUpdateMaster('minTransfer', masterData.minTransfer, 'set')} className="bg-blue-600 text-white px-8 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all">UPDATE</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Tag size={14}/> Master Kategori Transaksi</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold border" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Contoh: Listrik..." />
                        <button onClick={() => handleUpdateMaster('categories', newCategory, 'add')} className="bg-blue-600 text-white p-3 rounded-xl shadow-md"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {masterData.categories.map(c => (
                            <div key={c} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-600">{c} <button onClick={() => handleUpdateMaster('categories', c, 'remove')} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg"><Trash2 size={16}/></button></div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Users size={14}/> Master Anggota Keluarga</h3>
                    <div className="flex gap-2 mb-4">
                        <input type="text" className="flex-1 p-3 bg-slate-50 rounded-xl outline-none font-bold border" value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Nama baru..." />
                        <button onClick={() => handleUpdateMaster('familyMembers', newMember, 'add')} className="bg-emerald-600 text-white p-3 rounded-xl shadow-md"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {masterData.familyMembers.map(m => (
                            <div key={m} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-600">{m} <button onClick={() => handleUpdateMaster('familyMembers', m, 'remove')} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg"><Trash2 size={16}/></button></div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}
      </main>

      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-3xl overflow-hidden relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewImage(null)} className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full z-10"><X size={24}/></button>
            <img src={viewImage} className="w-full h-auto max-h-[75vh] object-contain p-2 rounded-2xl" alt="Bukti Transfer" />
            <div className="p-4 bg-white border-t text-center font-bold text-slate-500 text-sm">Pratinjau Bukti Transaksi</div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @media print {
          nav, .print\\:hidden, button { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; }
          .md\\:pl-64 { padding-left: 0 !important; }
          .printable-area { border: none !important; shadow: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
};

// Sub-Komponen UI
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-2 md:gap-4 p-3 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon}
    <span className="text-[10px] md:text-sm uppercase font-bold tracking-tight">{label}</span>
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

const StatusBadge = ({ status }) => {
  const cfg = {
    waiting: { c: 'bg-amber-100 text-amber-700', l: 'Proses' },
    approved: { c: 'bg-emerald-100 text-emerald-700', l: 'Sah' },
    rejected: { c: 'bg-rose-100 text-rose-700', l: 'Batal' }
  }[status] || { c: 'bg-slate-100 text-slate-400', l: status };
  return <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${cfg.c}`}>{cfg.l}</span>;
};

export default App;
