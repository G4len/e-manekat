import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  LayoutDashboard, PlusCircle, FileText, Settings, ArrowUpCircle, 
  ArrowDownCircle, Wallet, Printer, Trash2, CheckCircle2, 
  ShieldCheck, LogOut, X, Plus, Users, Tag, Lock, Eye, Clock, Loader2
} from 'lucide-react';

// --- CONFIGURATION LOADER ---
const getFirebaseConfig = () => {
  const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!envConfig) return null;
  try {
    return typeof envConfig === 'string' ? JSON.parse(envConfig) : envConfig;
  } catch (e) { return null; }
};

const firebaseConfig = getFirebaseConfig();
let db, auth;

if (firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

const appId = import.meta.env.VITE_APP_ID || 'e-manekat-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [masterData, setMasterData] = useState({ categories: [], familyMembers: [], minTransfer: 50000 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [notification, setNotification] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [newMember, setNewMember] = useState('');
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '', member: '' });
  
  const [formData, setFormData] = useState({
    type: 'simpanan', amount: '', description: '', 
    category: '', member: '', date: new Date().toISOString().split('T')[0],
    proofImage: null
  });

  const fileInputRef = useRef(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !role || !db) return;

    // Listen Transactions
    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.date) - new Date(a.date)));
    });

    // Listen Master Data
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      if (snap.exists()) {
        setMasterData(snap.data());
      } else {
        setDoc(masterRef, { categories: ['Kas Umum'], familyMembers: ['Admin'], minTransfer: 50000 });
      }
    });

    return () => { unsubTrans(); unsubMaster(); };
  }, [user, role]);

  // Statistik Saldo
  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === 'approved');
    const sim = approved.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const peng = approved.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return { total: sim - peng, simpanan: sim, pengeluaran: peng };
  }, [transactions]);

  // Master Actions
  const handleUpdateMaster = async (field, value, action = 'add') => {
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add' && value.trim()) {
        await updateDoc(masterRef, { [field]: arrayUnion(value.trim()) });
        field === 'categories' ? setNewCategory('') : setNewMember('');
      } else if (action === 'remove') {
        await updateDoc(masterRef, { [field]: arrayRemove(value) });
      }
      notify("Master diperbarui");
    } catch (e) { notify("Gagal simpan!", "error"); }
  };

  // Submit Transaksi
  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!formData.member || !formData.amount || !formData.category || !formData.proofImage) {
      return notify("Lengkapi data & foto!", "error");
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData, 
        amount: Number(formData.amount), status: 'waiting',
        userName: formData.member, createdAt: new Date().toISOString()
      });
      setFormData({...formData, amount: '', description: '', proofImage: null});
      notify("Berhasil dikirim ke admin");
      setActiveTab('dashboard');
    } catch (e) { notify("Error!", "error"); }
    finally { setIsSubmitting(false); }
  };

  if (!firebaseConfig) return <div className="p-10 text-center font-bold text-rose-500">Config VITE_FIREBASE_CONFIG Kosong di Vercel!</div>;

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center">
          <ShieldCheck size={50} className="mx-auto text-blue-600 mb-6" />
          <h1 className="text-3xl font-black mb-6 italic tracking-tighter text-slate-800">E-MANEKAT</h1>
          <div className="space-y-3">
            <button onClick={() => setRole('admin')} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black shadow-lg">LOGIN ADMIN</button>
            <button onClick={() => setRole('user')} className="w-full p-5 bg-emerald-50 text-emerald-600 rounded-2xl font-black">MASUK KELUARGA</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:pl-64 flex flex-col font-sans">
      {notification && <div className={`fixed top-6 right-6 p-4 px-8 rounded-2xl text-white font-black shadow-2xl z-[100] ${notification.type==='success'?'bg-emerald-500':'bg-rose-500'}`}>{notification.msg}</div>}
      
      {/* Sidebar Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2">
        <div className="hidden md:block p-6 mb-4 text-center text-blue-600 font-black text-2xl italic tracking-tighter">E-MANEKAT</div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard/>} label="Beranda" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle/>} label="Input" active={activeTab==='input'} onClick={()=>setActiveTab('input')} />
          {role==='admin' && <NavItem icon={<Clock/>} label="Antrean" active={activeTab==='approval'} onClick={()=>setActiveTab('approval')} badge={transactions.filter(t=>t.status==='waiting').length} />}
          <NavItem icon={<FileText/>} label="Laporan" active={activeTab==='report'} onClick={()=>setActiveTab('report')} />
          {role==='admin' && <NavItem icon={<Settings/>} label="Master" active={activeTab==='settings'} onClick={()=>setActiveTab('settings')} />}
          <button onClick={()=>setRole(null)} className="flex items-center gap-4 p-4 text-rose-500 font-black mt-auto hover:bg-rose-50 rounded-2xl"><LogOut size={20}/><span className="hidden md:block text-xs uppercase">Keluar</span></button>
        </div>
      </nav>

      <main className="p-4 md:p-10 max-w-5xl w-full mx-auto mb-20">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Saldo Kas" value={stats.total} icon={<Wallet/>} color="bg-blue-600" />
              <StatCard label="Total Masuk" value={stats.simpanan} icon={<ArrowUpCircle/>} color="bg-emerald-500" />
              <StatCard label="Total Keluar" value={stats.pengeluaran} icon={<ArrowDownCircle/>} color="bg-rose-500" />
            </div>
            
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-50 border-b font-black text-[10px] uppercase tracking-widest text-slate-400">Riwayat Terakhir</div>
              <div className="divide-y">
                {transactions.slice(0,5).map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${t.type==='simpanan'?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}`}>{t.type==='simpanan'?<ArrowUpCircle size={20}/>:<ArrowDownCircle size={20}/>}</div>
                      <div>
                        <div className="flex items-center gap-2"><p className="font-bold text-sm">{t.description}</p><span className="text-[8px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded-full">{t.status}</span></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">{t.userName} • {t.date}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${t.type==='simpanan'?'text-emerald-600':'text-rose-600'}`}>{t.type==='simpanan'?'+':'-'} {t.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-[40px] shadow-sm border">
            <h2 className="text-xl font-black mb-6 text-center italic uppercase">Input Data</h2>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>setFormData({...formData, type:'simpanan'})} className={`p-4 rounded-2xl border-2 font-black text-xs ${formData.type==='simpanan'?'border-emerald-500 bg-emerald-50 text-emerald-600':'border-slate-50 text-slate-300'}`}>SIMPANAN</button>
                <button type="button" onClick={()=>setFormData({...formData, type:'pengeluaran'})} className={`p-4 rounded-2xl border-2 font-black text-xs ${formData.type==='pengeluaran'?'border-rose-500 bg-rose-50 text-rose-600':'border-slate-50 text-slate-300'}`}>PENGELUARAN</button>
              </div>
              <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-none outline-none" value={formData.member} onChange={e=>setFormData({...formData, member:e.target.value})}>
                <option value="">-- Pilih Nama --</option>
                {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-none outline-none" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}>
                <option value="">-- Kategori --</option>
                {masterData.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="Nominal (Rp)" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xl border-none outline-none" value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} />
              <textarea placeholder="Keterangan..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-none outline-none" value={formData.description} onChange={e=>setFormData({...formData, description:e.target.value})} />
              <div className="border-2 border-dashed p-6 rounded-2xl text-center bg-slate-50 cursor-pointer" onClick={()=>fileInputRef.current.click()}>
                <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={e=>{
                  const reader = new FileReader();
                  reader.onload = () => setFormData({...formData, proofImage: reader.result});
                  reader.readAsDataURL(e.target.files[0]);
                }} />
                {formData.proofImage ? <p className="text-emerald-500 font-bold">✅ Foto Dimuat</p> : <p className="text-slate-400 font-bold">📸 Upload Bukti Foto</p>}
              </div>
              <button disabled={isSubmitting} className="w-full p-5 bg-blue-600 text-white rounded-2xl font-black shadow-lg uppercase tracking-widest">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto"/> : "KIRIM DATA"}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'approval' && role === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 mb-6">Persetujuan Admin</h2>
            {transactions.filter(t=>t.status==='waiting').map(t => (
              <div key={t.id} className="bg-white p-6 rounded-3xl border flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${t.type==='simpanan'?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}`}><PlusCircle/></div>
                  <div>
                    <p className="font-black text-slate-700">{t.description}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase">{t.userName} • Rp {t.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setViewImage(t.proofImage)} className="p-3 bg-blue-50 text-blue-600 rounded-xl font-black text-xs">BUKTI</button>
                  <button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','transactions',t.id),{status:'approved'})} className="p-3 px-6 bg-emerald-600 text-white rounded-xl font-black text-xs">SAH</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border">
              <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Tag size={14}/> Kategori</h3>
              <div className="flex gap-2 mb-4">
                <input value={newCategory} onChange={e=>setNewCategory(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-sm" placeholder="Tambah..." />
                <button onClick={() => handleUpdateMaster('categories', newCategory)} className="bg-blue-600 text-white p-3 rounded-xl">+</button>
              </div>
              <div className="space-y-2">
                {masterData.categories.map(c => (
                  <div key={c} className="flex justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-600">
                    {c} <button onClick={() => handleUpdateMaster('categories', c, 'remove')} className="text-rose-500"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border">
              <h3 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><Users size={14}/> Anggota</h3>
              <div className="flex gap-2 mb-4">
                <input value={newMember} onChange={e=>setNewMember(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-sm" placeholder="Nama..." />
                <button onClick={() => handleUpdateMaster('familyMembers', newMember)} className="bg-emerald-600 text-white p-3 rounded-xl">+</button>
              </div>
              <div className="space-y-2">
                {masterData.familyMembers.map(m => (
                  <div key={m} className="flex justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm text-slate-600">
                    {m} <button onClick={() => handleUpdateMaster('familyMembers', m, 'remove')} className="text-rose-500"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
           <div className="bg-white rounded-3xl border p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-black italic text-xl uppercase tracking-tighter">Laporan Kas</h2>
                <button onClick={()=>window.print()} className="p-3 bg-slate-900 text-white rounded-xl flex items-center gap-2 font-bold text-xs"><Printer size={16}/> CETAK</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr><th className="p-4">Tanggal</th><th className="p-4">Nama</th><th className="p-4">Keterangan</th><th className="p-4 text-right">Jumlah</th></tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {transactions.filter(t=>t.status==='approved').map(t=>(
                      <tr key={t.id}>
                        <td className="p-4 font-bold text-slate-400">{t.date}</td>
                        <td className="p-4 font-black">{t.userName}</td>
                        <td className="p-4 font-bold text-slate-600">{t.description}</td>
                        <td className={`p-4 text-right font-black ${t.type==='simpanan'?'text-emerald-600':'text-rose-600'}`}>{t.type==='simpanan'?'+':'-'} {t.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        )}
      </main>

      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={()=>setViewImage(null)}>
          <img src={viewImage} className="max-w-full max-h-[90vh] rounded-2xl" />
        </div>
      )}
    </div>
  );
};

// --- SUB COMPONENTS ---
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-3 p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon} <span className="text-[10px] md:text-xs uppercase font-black">{label}</span>
    {badge > 0 && <span className="absolute top-2 right-4 bg-rose-500 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border flex items-center gap-5 shadow-sm">
    <div className={`p-4 rounded-2xl ${color} text-white shadow-lg`}>{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h2 className="text-xl font-black text-slate-800 tracking-tighter">Rp {value.toLocaleString()}</h2>
    </div>
  </div>
);

export default App;
