import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  query 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Layout, 
  Users, 
  Wallet, 
  PlusCircle, 
  TrendingUp, 
  History, 
  AlertCircle,
  Loader2
} from 'lucide-react';

/**
 * Pengambilan konfigurasi Firebase dengan cara yang lebih kompatibel.
 * Menggunakan pengecekan typeof untuk menghindari error pada target lingkungan lama.
 */
const getFirebaseConfig = () => {
  try {
    // Mencoba mengakses import.meta secara aman
    const metaEnv = typeof import.meta !== 'undefined' && import.meta.env 
      ? import.meta.env.VITE_FIREBASE_CONFIG 
      : null;
    
    // Fallback ke process.env jika tersedia (untuk lingkungan non-Vite tertentu)
    const processEnv = typeof process !== 'undefined' && process.env 
      ? process.env.VITE_FIREBASE_CONFIG 
      : null;

    const configStr = metaEnv || processEnv;

    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (e) {
    console.error("Gagal memuat konfigurasi Firebase:", e);
  }
  return {};
};

const firebaseConfig = getFirebaseConfig();

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'e-manekat-pro-v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Gagal Login Anonim:", err);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }, (err) => {
      console.error("Kesalahan Firestore (Transaksi):", err);
    });

    const mQ = query(collection(db, 'artifacts', appId, 'public', 'data', 'members'));
    const unsubscribeMembers = onSnapshot(mQ, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Kesalahan Firestore (Anggota):", err);
    });

    return () => {
      unsubscribeTrans();
      unsubscribeMembers();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium font-sans">Menghubungkan ke Server...</p>
      </div>
    );
  }

  const totalSaldo = transactions.reduce((acc, curr) => 
    curr.type === 'masuk' ? acc + (Number(curr.amount) || 0) : acc - (Number(curr.amount) || 0), 0
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="bg-blue-700 text-white p-6 rounded-b-3xl shadow-lg mb-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layout className="w-6 h-6" /> E-Manekat Pro
          </h1>
          <p className="opacity-80 text-sm mb-4">Kas Digital Keluarga</p>
          
          <div className="bg-white/20 p-5 rounded-2xl backdrop-blur-md border border-white/10">
            <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold mb-1">Total Saldo Saat Ini</p>
            <h2 className="text-3xl font-black">
              Rp {totalSaldo.toLocaleString('id-ID')}
            </h2>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <TrendingUp className="text-emerald-500 mb-2" size={20} />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pemasukan</p>
                <p className="font-bold text-emerald-600">
                  Rp {transactions.filter(t => t.type === 'masuk').reduce((a,b) => a + (Number(b.amount) || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <History className="text-rose-500 mb-2" size={20} />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pengeluaran</p>
                <p className="font-bold text-rose-600">
                  Rp {transactions.filter(t => t.type === 'keluar').reduce((a,b) => a + (Number(b.amount) || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>

            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mt-6 uppercase tracking-wider">
              <History className="w-4 h-4 text-blue-600" /> Riwayat Transaksi
            </h3>
            
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-sm italic">
                  Belum ada catatan transaksi
                </div>
              ) : (
                transactions.slice(0, 10).map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${t.type === 'masuk' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'masuk' ? <TrendingUp size={16}/> : <History size={16}/>}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{t.note || 'Tanpa keterangan'}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase">
                          {t.timestamp ? new Date(t.timestamp).toLocaleDateString('id-ID') : 'Baru saja'} • {t.memberName || 'Umum'}
                        </p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${t.type === 'masuk' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'masuk' ? '+' : '-'} {Number(t.amount).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Daftar Anggota Keluarga</h3>
            {members.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-sm">Data anggota belum tersedia.</p>
            ) : (
              members.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4 border border-slate-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg shadow-inner">
                    {m.name ? m.name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{m.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.role || 'Anggota Keluarga'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-3 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-300'}`}>
            <Layout className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase">Beranda</span>
          </button>
          
          <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'members' ? 'text-blue-600' : 'text-slate-300'}`}>
            <Users className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase">Keluarga</span>
          </button>

          <button className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-200 -mt-12 border-4 border-slate-50 active:scale-95 transition-transform">
            <PlusCircle className="w-6 h-6" />
          </button>

          <button className="flex flex-col items-center gap-1 text-slate-300">
            <Wallet className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase">Tabungan</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-slate-300">
            <AlertCircle className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase">Laporan</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
