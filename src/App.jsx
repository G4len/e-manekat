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

// Firebase Config dari Vercel Environment Variables
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
  const [masterData, setMasterData] = useState({
    categories: ['Umum', 'Pendidikan', 'Kesehatan', 'Rumah Tangga'],
    familyMembers: ['Ayah', 'Ibu'],
    minTransfer: 50000
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });

  // State untuk Filter Laporan
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    member: '',
    type: ''
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
      else setDoc(masterDoc, masterData);
    });

    return () => { unsubscribeTrans(); unsubscribeMaster(); };
  }, [user, role]);

  // LOGIC FILTER UTAMA
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
    const approved = transactions.filter(t => t.status === 'approved');
    const simpanan = approved.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const pengeluaran = approved.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return { total: simpanan - pengeluaran, simpanan, pengeluaran };
  }, [transactions]);

  const filteredTotal = useMemo(() => {
    const sim = filteredTransactions.filter(t => t.type === 'simpanan').reduce((s, t) => s + Number(t.amount), 0);
    const peng = filteredTransactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + Number(t.amount), 0);
    return sim - peng;
  }, [filteredTransactions]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginCreds.username === 'admin' && loginCreds.password === '@Angker2026') {
      setRole('admin'); setShowLoginModal(false); notify("Admin Terverifikasi", "success");
    } else notify("Akses Ditolak!");
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
        ...formData, amount: Number(formData.amount), createdAt: new Date().toISOString(),
        userId: user.uid, userName: formData.member, status: 'waiting' 
      });
      setFormData({ ...formData, amount: '', description: '', proofImage: null });
      notify("Berhasil dikirim", "success"); setActiveTab('dashboard');
    } catch (err) { notify("Gagal simpan"); } finally { setIsSubmitting(false); }
  };

  const shareWhatsApp = () => {
    const filterInfo = `Periode: ${reportFilters.startDate || 'Awal'} s/d ${reportFilters.endDate || 'Sekarang'}\nAnggota: ${reportFilters.member || 'Semua'}`;
    const text = `*LAPORAN KAS E-MANEKAT*\n${filterInfo}\n\n💰 *Total Saldo:* Rp ${filteredTotal.toLocaleString()}\n\n_© 2026 Galen Adonai Piandi Banunu_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><ShieldCheck className="text-white" /></div>
          <h1 className="text-2xl font-black mb-6">E-MANEKAT</h1>
          <div className="space-y-3">
            <button onClick={() => setShowLoginModal(true)} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"><Lock size={18}/> Login Admin</button>
            <button onClick={() => setRole('user')} className="w-full p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border-2 border-emerald-100">Masuk sebagai Keluarga</button>
          </div>
        </div>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form onSubmit={handleAdminLogin} className="bg-white p-6 rounded-3xl w-full max-w-sm">
              <input type="text" placeholder="Username" className="w-full p-3 bg-slate-50 border rounded-xl mb-3" onChange={e => setLoginCreds({...loginCreds, username: e.target.value})} />
              <input type="password" placeholder="Password" className="w-full p-3 bg-slate-50 border rounded-xl mb-4" onChange={e => setLoginCreds({...loginCreds, password: e.target.value})} />
              <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">LOGIN</button>
              <button type="button" onClick={() => setShowLoginModal(false)} className="w-full mt-2 text-slate-400 text-sm">Batal</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64 flex flex-col font-sans">
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t md:top-0 md:left-0 md:w-64 md:h-full md:border-r z-40 flex md:flex-col p-2 md:p-6 print:hidden">
        <div className="hidden md:block mb-10"><h1 className="text-xl font-black text-blue-600">E-MANEKAT</h1></div>
        <div className="flex md:flex-col w-full gap-1">
          <NavItem icon={<LayoutDashboard />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Input" active={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          {role === 'admin' && <NavItem icon={<CheckCircle2 />} label="Konfirmasi" active={activeTab === 'approval'} onClick={() => setActiveTab('approval')} badge={transactions.filter(t => t.status === 'waiting').length} />}
          <NavItem icon={<FileText />} label="Laporan" active={activeTab === 'report'} onClick={() => setActiveTab('report')} />
          <button onClick={() => setRole(null)} className="flex items-center gap-3 p-3 text-rose-500 font-bold mt-auto"><LogOut size={20}/> Logout</button>
        </div>
      </nav>

      <main className="p-4 md:p-8 flex-grow max-w-5xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Kas" value={stats.total} icon={<Wallet />} color="bg-blue-600" />
            <StatCard label="Total Simpanan" value={stats.simpanan} icon={<ArrowUpCircle />} color="bg-emerald-500" />
            <StatCard label="Total Pengeluaran" value={stats.pengeluaran} icon={<ArrowDownCircle />} color="bg-rose-500" />
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white p-6 rounded-3xl border">
            <h2 className="font-black mb-6">INPUT TRANSAKSI</h2>
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormData({...formData, type: 'simpanan'})} className={`p-3 rounded-xl border-2 font-bold ${formData.type === 'simpanan' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : ''}`}>Simpanan</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'pengeluaran'})} className={`p-3 rounded-xl border-2 font-bold ${formData.type === 'pengeluaran' ? 'border-rose-500 bg-rose-50 text-rose-600' : ''}`}>Pengeluaran</button>
              </div>
              <select required className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={formData.member} onChange={e => setFormData({...formData, member: e.target.value})}>
                <option value="">Pilih Anggota</option>
                {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="number" placeholder="Nominal Rp" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xl" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              <textarea placeholder="Keterangan..." className="w-full p-4 bg-slate-50 border rounded-2xl" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              <div className="border-2 border-dashed p-4 rounded-2xl text-center">
                <input type="file" hidden ref={fileInputRef} onChange={e => {
                  const reader = new FileReader();
                  reader.onload = () => setFormData({...formData, proofImage: reader.result});
                  reader.readAsDataURL(e.target.files[0]);
                }} />
                <button type="button" onClick={() => fileInputRef.current.click()} className="text-sm font-bold text-blue-600 uppercase tracking-widest">{formData.proofImage ? "✅ Foto Terlampir" : "📸 Upload Bukti"}</button>
              </div>
              <button disabled={isSubmitting} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">{isSubmitting ? "Mengirim..." : "KIRIM SEKARANG"}</button>
            </form>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            {/* PANEL FILTER */}
            <div className="bg-white p-6 rounded-3xl border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Dari</label>
                <input type="date" className="w-full p-2 bg-slate-50 border rounded-xl text-sm" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Sampai</label>
                <input type="date" className="w-full p-2 bg-slate-50 border rounded-xl text-sm" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Anggota</label>
                <select className="w-full p-2 bg-slate-50 border rounded-xl text-sm" value={reportFilters.member} onChange={e => setReportFilters({...reportFilters, member: e.target.value})}>
                  <option value="">Semua</option>
                  {masterData.familyMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={shareWhatsApp} className="flex-1 bg-emerald-600 text-white p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Share2 size={14}/> Share</button>
                <button onClick={() => window.print()} className="flex-1 bg-blue-600 text-white p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Printer size={14}/> Print</button>
              </div>
            </div>

            {/* TABEL LAPORAN */}
            <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm">Data Kas Terfilter</h3>
                <span className="font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs">Rp {filteredTotal.toLocaleString()}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                    <tr><th className="p-4">Tanggal</th><th className="p-4">Nama</th><th className="p-4">Keterangan</th><th className="p-4 text-right">Nominal</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-400">{t.date}</td>
                        <td className="p-4 font-bold">{t.userName}</td>
                        <td className="p-4">{t.description}</td>
                        <td className={`p-4 text-right font-black ${t.type === 'simpanan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'simpanan' ? '+' : '-'} {t.amount.toLocaleString()}
                        </td>
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
            <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs mb-6">Menunggu Konfirmasi</h3>
            {transactions.filter(t => t.status === 'waiting').map(t => (
              <div key={t.id} className="bg-white p-5 rounded-3xl border flex items-center justify-between">
                <div>
                  <p className="font-black text-slate-800">{t.description}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase">{t.userName} • Rp {t.amount.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewImage(t.proofImage)} className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Eye size={18}/></button>
                  <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id), { status: 'approved' })} className="p-3 px-5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100">Sah</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FOOTER SESUAI PERMINTAAN */}
        <footer className="mt-12 pb-6 text-center print:hidden">
          <div className="pt-6 border-t border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              © 2026 Galen Adonai Piandi Banunu
            </p>
            <p className="text-[8px] font-bold text-slate-300 mt-1 uppercase tracking-widest">
              E-Manekat Pro • Family Finance System
            </p>
          </div>
        </footer>
      </main>

      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImage(null)}>
          <div className="max-w-xl w-full bg-white rounded-3xl relative" onClick={e => e.stopPropagation()}>
             <img src={viewImage} className="w-full h-auto rounded-3xl p-2" alt="Proof" />
             <button onClick={() => setViewImage(null)} className="absolute -top-4 -right-4 bg-white p-2 rounded-full shadow-xl"><X size={20}/></button>
          </div>
        </div>
      )}

      <style>{`
        @media print { 
          nav, button, footer, .print\\:hidden { display: none !important; } 
          body { background: white !important; margin: 0 !important; color: black !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; } 
          .md\\:pl-64 { padding-left: 0 !important; }
          .border { border-color: #eee !important; }
        }
      `}</style>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`relative flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:p-4 md:w-full rounded-2xl transition-all ${active ? 'text-blue-600 md:bg-blue-50 font-black' : 'text-slate-400'}`}>
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
