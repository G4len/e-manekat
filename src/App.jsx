import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Trash2, CheckCircle2, 
  ShieldCheck, LogOut, X, Plus, Users, Tag, Lock, Loader2, Eye, Clock
} from 'lucide-react';

// --- INITIALIZE FIREBASE ---
const getFirebaseConfig = () => {
  try {
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    return envConfig ? JSON.parse(envConfig) : {};
  } catch (e) { return {}; }
};

const app = initializeApp(getFirebaseConfig());
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

  const notify = (msg, type = 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Fail:", err));
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !role) return;

    // Ambil Transaksi
    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.date) - new Date(a.date)));
    });

    // Ambil & Inisialisasi Master (KUNCI AGAR BISA TAMBAH DATA)
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      if (snap.exists()) {
        setMasterData(snap.data());
      } else {
        // Jika data master kosong, buat otomatis agar tidak error
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

  const handleUpdateMaster = async (field, value, action = 'add') => {
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add') {
        if (!value.trim()) return;
        await updateDoc(masterRef, { [field]: arrayUnion(value.trim()) });
        field === 'categories' ? setNewCategory('') : setNewMember('');
      } else if (action === 'remove') {
        await updateDoc(masterRef, { [field]: arrayRemove(value) });
      } else {
        await updateDoc(masterRef, { [field]: value });
      }
      notify("Berhasil diperbarui", "success");
    } catch (e) { 
      console.error(e);
      notify("Gagal! Cek Koneksi/Izin Database"); 
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!formData.member || !formData.amount || !formData.category || !formData.proofImage) {
      return notify("Lengkapi semua data & foto bukti!");
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData, 
        amount: Number(formData.amount), 
        status: 'waiting',
        userId: user.uid,
        userName: formData.member,
        createdAt: new Date().toISOString()
      });
      setFormData({...formData, amount: '', description: '', proofImage: null});
      notify("Data terkirim ke Admin", "success");
      setActiveTab('dashboard');
    } catch (e) { notify("Gagal kirim data"); }
    finally { setIsSubmitting(false); }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center border border-white">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">E-MANEKAT</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Family Finance v2</p>
          <div className="space-y-3">
            <button onClick={() => setShowLoginModal(true)} className="w-full p-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-black transition-all">
              <Lock size={18}/> LOGIN ADMIN
            </button>
            <button onClick={() => setRole('user')} className="w-full p-5 bg-emerald-50 text-emerald-600 rounded-2xl font-black border-2 border-emerald-100 hover:bg-emerald-100 transition-all">
              MASUK KELUARGA
            </button>
          </div>
        </div>
        {showLoginModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-[35px] w-full max-w-xs shadow-2xl">
              <h2 className="text-center font-black mb-6 text-slate-400 text-xs tracking-widest uppercase">Verifikasi Admin</h2>
              <input type="text" placeholder="Username" className="w-full p-4 bg-slate-50 border rounded-2xl mb-2 font-bold outline-none focus:border-blue-500" onChange={e=>setLoginCreds({...loginCreds, username: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border rounded-2xl mb-4 font-bold outline-none focus:border-blue-500" onChange={e=>setLoginCreds({...loginCreds, password: e.target.value})} />
              <button onClick={() => {
                if(loginCreds.username==='admin' && loginCreds.password==='@Angker2026') setRole('admin');
                else notify("Akses Ditolak!");
              }} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-blue-100">MASUK</button>
              <button onClick={()=>setShowLoginModal(false)} className="w-full mt-4 text-slate-400 font-bold text-xs">BATAL</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 flex flex-col font-sans">
      {notification && <div className={`fixed top-6 right-6 p-4 px-8 rounded-2xl text-white font-black shadow-2xl z-[100] animate-bounce ${notification.type==='success'?'bg-emerald-500':'bg-rose-500'}`}>{notification.msg}</div>}
      
      {/* SIDEBAR NAVIGATION */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2 md:p-6 shadow-2xl md:shadow-none">
        <div className="hidden md:block mb-10 text-center"><h1 className="text-2xl font-black text-blue-600 tracking-tighter italic">E-MANEKAT</h1></div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard/>} label="Beranda" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle/>} label="Input" active={activeTab==='input'} onClick={()=>setActiveTab('input')} />
          {role==='admin' && <NavItem icon={<Clock/>} label="Antrean" active={activeTab==='approval'} onClick={()=>setActiveTab('approval')} badge={transactions.filter(t=>t.status==='waiting').length} />}
          <NavItem icon={<FileText/>} label="Laporan" active={activeTab==='report'} onClick={()=>setActiveTab('report')} />
          {role==='admin' && <NavItem icon={<Settings/>} label="Master" active={activeTab==='settings'} onClick={()=>setActiveTab('settings')} />}
          <button onClick={()=>setRole(null)} className="flex items-center justify-center md:justify-start gap-4 p-4 text-rose-500 font-black mt-auto hover:bg-rose-50 rounded-2xl transition-all"><LogOut size={20}/><span className="hidden md:block">Logout</span></button>
        </div>
      </nav>

      <main className="p-4 md:p-10 max-w-5xl w-full mx-auto mb-24 md:mb-0">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Kas Keluarga" value={stats.total} icon={<Wallet/>} color="bg-blue-600" />
              <StatCard label="Total Masuk" value={stats.simpanan} icon={<ArrowUpCircle/>} color="bg-emerald-500" />
              <StatCard label="Total Keluar" value={stats.pengeluaran} icon={<ArrowDownCircle/>} color="bg-rose-500" />
            </div>
            
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Aktivitas Terkini</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border">Live Update</span>
              </div>
              <div className="divide-y divide-slate-50">
                {transactions.length === 0 ? <p className="p-20 text-center text-slate-300 font-bold italic text-sm">Belum ada riwayat transaksi</p> :
                  transactions.slice(0,6).map(t => (
                    <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${t.type==='simpanan'?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}`}>
                          {t.type==='simpanan' ? <ArrowUpCircle size={20}/> : <ArrowDownCircle size={20}/>}
                        </div>
                        <div>
                          <div className="flex items-center gap-2"><p className="font-black text-slate-700 text-sm">{t.description}</p><StatusBadge status={t.status}/></div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{t.userName} • {t.date}</p>
                        </div>
                      </div>
                      <p className={`font-black text-sm ${t.type==='simpanan'?'text-emerald-600':'text-rose-600'}`}>{t.type==='simpanan'?'+':'-'} Rp {t.amount.toLocaleString()}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-8 md:p-10 rounded-[40px] border border-slate-100 shadow-xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black mb-8 text-center text-slate-800 tracking-tighter">TAMBAH DATA</h2>
            <form onSubmit={handleSaveTransaction} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={()=>setFormData({...formData, type:'simpanan'})} className={`p-4 rounded-2xl border-2 font-black transition-all ${formData.type==='simpanan'?'border-emerald-500 bg-emerald-50 text-emerald-600':'border-slate-50 bg-slate-50 text-slate-300'}`}>SIMPANAN</button>
                <button type="button" onClick={()=>setFormData({...formData, type:'pengeluaran'})} className={`p-4 rounded-2xl border-2 font-black transition-all ${formData.type==='pengeluaran'?'border-rose-500 bg-rose-50 text-rose-600':'border-slate-50 bg-slate-50 text-slate-300'}`}>KELUAR</button>
              </div>
              <div className="space-y-4">
                <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={formData.member} onChange={e=>setFormData({...formData, member:e.target.value})}>
                  <option value="">-- Pilih Anggota --</option>
                  {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                  <option value="">-- Kategori --</option>
                  {masterData.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">Rp</span>
                  <input type="number" placeholder="Nominal" className="w-full p-4 pl-12 bg-slate-50 border rounded-2xl font-black text-2xl outline-none focus:border-blue-500" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} />
                </div>
                <textarea placeholder="Keterangan..." className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none min-h-[100px]" value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} />
                <div className="border-2 border-dashed border-slate-200 p-8 rounded-[30px] text-center bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer" onClick={()=>fileInputRef.current.click()}>
                  <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={e=>{
                    const file = e.target.files[0];
                    if(file) {
                      const reader = new FileReader();
                      reader.onload = () => setFormData({...formData, proofImage: reader.result});
                      reader.readAsDataURL(file);
                    }
                  }} />
                  {formData.proofImage ? <p className="text-emerald-500 font-black text-xs uppercase">✅ Foto Berhasil Dimuat</p> : <p className="text-slate-400 font-black text-xs uppercase tracking-widest">📸 Upload Bukti Foto</p>}
                </div>
              </div>
              <button disabled={isSubmitting} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto"/> : "KIRIM SEKARANG"}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">PENGATURAN MASTER</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MASTER KATEGORI */}
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={16}/> Master Kategori</h3>
                <div className="flex gap-2 mb-6">
                  <input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Tambah baru..." className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none" />
                  <button onClick={()=>handleUpdateMaster('categories', newCategory)} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg"><Plus/></button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {masterData.categories.map(c => (
                    <div key={c} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl font-bold text-slate-600 text-sm">
                      {c} <button onClick={()=>handleUpdateMaster('categories', c, 'remove')} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* MASTER ANGGOTA */}
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={16}/> Master Anggota</h3>
                <div className="flex gap-2 mb-6">
                  <input value={newMember} onChange={e=>setNewMember(e.target.value)} placeholder="Nama anggota..." className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none" />
                  <button onClick={()=>handleUpdateMaster('familyMembers', newMember)} className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg"><Plus/></button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {masterData.familyMembers.map(m => (
                    <div key={m} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl font-bold text-slate-600 text-sm">
                      {m} <button onClick={()=>handleUpdateMaster('familyMembers', m, 'remove')} className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approval' && role === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black mb-6 uppercase tracking-[0.2em] text-slate-400 text-center">Konfirmasi Admin</h2>
            {transactions.filter(t=>t.status==='waiting').length === 0 ? <p className="p-20 text-center text-slate-300 font-black italic uppercase tracking-widest">Semua data sudah bersih</p> :
              transactions.filter(t=>t.status==='waiting').map(t => (
                <div key={t.id} className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5 w-full">
                    <div className={`p-5 rounded-3xl ${t.type==='simpanan'?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}`}><PlusCircle size={30}/></div>
                    <div>
                      <h4 className="font-black text-slate-800 text-lg leading-tight">{t.description}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t.userName} • Rp {t.amount.toLocaleString()} • {t.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={()=>setViewImage(t.proofImage)} className="flex-1 md:flex-none p-4 px-8 bg-blue-50 text-blue-600 font-black rounded-2xl hover:bg-blue-100 flex items-center justify-center gap-2"><Eye size={18}/> BUKTI</button>
                    <button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','transactions',t.id),{status:'approved'})} className="flex-1 md:flex-none p-4 px-10 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700">SAH</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </main>

      {/* VIEW IMAGE MODAL */}
      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-[40px] overflow-hidden shadow-2xl relative" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setViewImage(null)} className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full"><X size={20}/></button>
            <img src={viewImage} className="w-full h-auto max-h-[80vh] object-contain p-2 rounded-[40px]" alt="Proof" />
          </div>
        </div>
      )}

      <style>{`
        @media print { nav, button, .print\\:hidden { display: none !important; } }
      `}</style>
    </div>
  );
};

// HELPERS
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-2 md:gap-4 p-4 md:w-full rounded-[20px] transition-all ${active ? 'text-blue-600 md:bg-blue-50/50 font-black' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
    {icon}
    <span className="text-[10px] md:text-sm uppercase font-black tracking-tight">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-4 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
    <div className={`p-4 rounded-2xl ${color} text-white shadow-xl`}>{icon}</div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h2 className="text-xl font-black text-slate-800 tracking-tighter">Rp {value.toLocaleString()}</h2>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const cfg = {
    waiting: { c: 'bg-amber-100 text-amber-700', l: 'Proses' },
    approved: { c: 'bg-emerald-100 text-emerald-700', l: 'Sah' },
    rejected: { c: 'bg-rose-100 text-rose-700', l: 'Batal' }
  }[status] || { c: 'bg-slate-100 text-slate-400', l: '?' };
  return <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${cfg.c}`}>{cfg.l}</span>;
};

export default App;
