import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ShieldCheck, Tag, Users, Trash2, Plus } from 'lucide-react';

// Ambil config dari Vercel
const getFirebaseConfig = () => {
  const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!envConfig) return null;
  try {
    return typeof envConfig === 'string' ? JSON.parse(envConfig) : envConfig;
  } catch (e) {
    console.error("Format JSON salah di Vercel");
    return null;
  }
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
  const [masterData, setMasterData] = useState({ categories: [], familyMembers: [] });
  const [newCategory, setNewCategory] = useState('');
  const [newMember, setNewMember] = useState('');

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !role || !db) return;
    
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    const unsub = onSnapshot(masterRef, (snap) => {
      if (snap.exists()) {
        setMasterData(snap.data());
      } else {
        setDoc(masterRef, { categories: ['Umum'], familyMembers: ['Admin'] });
      }
    });
    return () => unsub();
  }, [user, role]);

  const updateMaster = async (field, value, action = 'add') => {
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'master');
    try {
      if (action === 'add' && value.trim()) {
        await updateDoc(masterRef, { [field]: arrayUnion(value.trim()) });
        field === 'categories' ? setNewCategory('') : setNewMember('');
      } else if (action === 'remove') {
        await updateDoc(masterRef, { [field]: arrayRemove(value) });
      }
    } catch (e) {
      alert("Gagal! Pastikan Firestore Rules sudah di-Publish ke 'allow read, write: if true;'");
    }
  };

  if (!firebaseConfig) {
    return <div className="p-10 text-center font-bold text-rose-500">Config Firebase belum terpasang di Vercel!</div>;
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-10 rounded-[40px] shadow-xl text-center max-w-sm w-full">
          <ShieldCheck size={60} className="mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-black mb-8 italic">E-MANEKAT</h1>
          <button onClick={() => setRole('admin')} className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold mb-3">ADMIN</button>
          <button onClick={() => setRole('user')} className="w-full p-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">KELUARGA</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black italic">PENGATURAN MASTER</h2>
        <button onClick={() => setRole(null)} className="text-rose-500 font-bold">Logout</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border">
          <h3 className="text-xs font-black text-slate-400 mb-4 flex items-center gap-2"><Tag size={16}/> KATEGORI</h3>
          <div className="flex gap-2 mb-4">
            <input value={newCategory} onChange={e=>setNewCategory(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border font-bold outline-none" placeholder="Tambah..." />
            <button onClick={() => updateMaster('categories', newCategory)} className="bg-blue-600 text-white p-3 rounded-xl"><Plus/></button>
          </div>
          <div className="space-y-2">
            {masterData.categories.map(c => (
              <div key={c} className="flex justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm">
                {c} <button onClick={() => updateMaster('categories', c, 'remove')} className="text-rose-500"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border">
          <h3 className="text-xs font-black text-slate-400 mb-4 flex items-center gap-2"><Users size={16}/> ANGGOTA</h3>
          <div className="flex gap-2 mb-4">
            <input value={newMember} onChange={e=>setNewMember(e.target.value)} className="flex-1 p-3 bg-slate-50 rounded-xl border font-bold outline-none" placeholder="Nama..." />
            <button onClick={() => updateMaster('familyMembers', newMember)} className="bg-emerald-600 text-white p-3 rounded-xl"><Plus/></button>
          </div>
          <div className="space-y-2">
            {masterData.familyMembers.map(m => (
              <div key={m} className="flex justify-between p-3 bg-slate-50 rounded-xl font-bold text-sm">
                {m} <button onClick={() => updateMaster('familyMembers', m, 'remove')} className="text-rose-500"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
