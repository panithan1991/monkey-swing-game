const KEY = 'monkey-swing-ranks-v2';
const config = window.MONKEY_FIREBASE_CONFIG;
let firebasePromise;

export function onlineEnabled() { return !!(config?.apiKey && config?.projectId && config?.appId); }

function localRead() {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch (_) { return []; }
}
export function localRanks() { return localRead().sort((a,b)=>b.score-a.score).slice(0,20); }

async function firebase() {
  if (!onlineEnabled()) throw new Error('Firebase is not configured');
  firebasePromise ||= (async () => {
    const [{ initializeApp }, auth, db] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
    ]);
    const app = initializeApp(config);
    const authentication = auth.getAuth(app);
    await auth.setPersistence(authentication, auth.browserLocalPersistence);
    await authentication.authStateReady();
    if (!authentication.currentUser) await auth.signInAnonymously(authentication);
    return { auth: authentication, db: db.getFirestore(app), f: db };
  })();
  try { return await firebasePromise; } catch (error) { firebasePromise = null; throw error; }
}

export async function loadRanks() {
  const { db, f } = await firebase();
  const q = f.query(f.collection(db,'scores'), f.orderBy('score','desc'), f.limit(20));
  const snapshot = await f.getDocs(q);
  return snapshot.docs.map(doc=>doc.data());
}

export async function saveRank(result) {
  const row = { name: String(result.name || 'นักโหนป่า').trim().slice(0,18), score: Math.max(0,Math.floor(result.score)), distance: Math.max(0,Math.floor(result.distance)), bestCombo: Math.max(1,Math.floor(result.bestCombo)) };
  const local = localRead();
  const at = local.findIndex(item=>item.name===row.name);
  if (at < 0) local.push(row);
  else if (row.score > local[at].score) local[at] = row;
  localStorage.setItem(KEY, JSON.stringify(local.sort((a,b)=>b.score-a.score).slice(0,20)));
  if (!onlineEnabled()) return { online: false };
  const { auth, db, f } = await firebase();
  const ref = f.doc(db, 'scores', auth.currentUser.uid);
  const previous = await f.getDoc(ref);
  if (!previous.exists() || row.score > (previous.data().score || 0)) {
    await f.setDoc(ref, { ...row, updatedAt: f.serverTimestamp() });
  }
  return { online: true };
}
