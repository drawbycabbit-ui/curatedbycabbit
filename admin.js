import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Referensi Elemen DOM
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const productForm = document.getElementById('productForm');
const adminProductList = document.getElementById('adminProductList');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');

// Cache untuk menyimpan data produk sementara agar tidak perlu parse JSON lagi
let productsCache = {};

// --- 1. MANAJEMEN AUTENTIKASI ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadAdminProducts();
    } else {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginError.classList.add('hidden');
        loginForm.reset();
    } catch (error) {
        console.error(error);
        loginError.textContent = "Email atau password salah!";
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- 2. MANAJEMEN DATA PRODUK (CRUD) ---

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('productId').value;
    
    const tagsRaw = document.getElementById('prodTags').value;
    const tagsArray = tagsRaw
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0);

    const productData = {
        name: document.getElementById('prodName').value,
        brand: document.getElementById('prodBrand').value,
        storeName: document.getElementById('prodStoreName').value,
        tags: tagsArray,
        imageUrl: document.getElementById('prodImage').value,
        affiliateLink: document.getElementById('prodAffiliate').value,
        updatedAt: serverTimestamp()
    };

    if (!id) productData.createdAt = serverTimestamp();

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Menyimpan...";

        if (id) {
            await updateDoc(doc(db, "products", id), productData);
            alert("Produk berhasil diperbarui!");
        } else {
            await addDoc(collection(db, "products"), productData);
            alert("Produk baru berhasil ditambahkan!");
        }

        resetForm();
        loadAdminProducts();
    } catch (error) {
        console.error("Gagal menyimpan produk:", error);
        alert("Terjadi kesalahan saat menyimpan.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Simpan Produk";
    }
});

// Helper: Mencegah XSS & SyntaxError (Karakter < > & " ' diubah jadi aman)
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')   // Mencegah kutip ganda merusak atribut HTML
        .replace(/'/g, '&#039;');  // Mencegah kutip tunggal merusak atribut HTML
}

async function loadAdminProducts() {
    adminProductList.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Memuat data...</td></tr>';
    productsCache = {}; // Reset cache
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        adminProductList.innerHTML = '';

        querySnapshot.forEach((docSnap) => {
            const p = docSnap.data();
            productsCache[docSnap.id] = p; // Simpan objek asli ke cache
            
            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition";
            
            row.innerHTML = `
                <td class="p-4"><img src="${escapeHTML(p.imageUrl)}" class="w-12 h-12 object-cover rounded bg-gray-200" onerror="this.src='https://via.placeholder.com/48'"></td>
                <td class="p-4">
                    <div class="font-semibold text-dark">${escapeHTML(p.name)}</div>
                    <div class="text-xs text-gray-500">${escapeHTML(p.brand || '-')}</div>
                </td>
                <td class="p-4 text-sm">${escapeHTML(p.storeName || '-')}</td>
                <td class="p-4">
                    <div class="flex flex-wrap gap-1">
                        ${(p.tags || []).map(tag => 
                            `<span class="bg-light text-secondary text-xs px-2 py-0.5 rounded">${escapeHTML(tag)}</span>`
                        ).join('')}
                    </div>
                </td>
                <td class="p-4 text-right space-x-2">
                    <button class="edit-btn text-primary hover:text-secondary font-semibold text-xs border border-primary px-2 py-1 rounded" data-id="${docSnap.id}">Edit</button>
                    <button class="delete-btn text-accent hover:text-red-800 font-semibold text-xs border border-accent px-2 py-1 rounded" data-id="${docSnap.id}">Hapus</button>
                </td>
            `;
            adminProductList.appendChild(row);
        });
    } catch (error) {
        console.error("Gagal memuat data:", error);
        adminProductList.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Gagal memuat data.</td></tr>';
    }
}

// EVENT DELEGATION: Menangani klik tombol Edit dan Hapus secara terpusat
adminProductList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
        const id = editBtn.dataset.id;
        const productData = productsCache[id];
        if (productData) prepareEditProduct(id, productData);
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        deleteProduct(id);
    }
});

async function deleteProduct(id) {
    if (confirm("Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.")) {
        try {
            await deleteDoc(doc(db, "products", id));
            loadAdminProducts();
        } catch (error) {
            console.error("Gagal menghapus:", error);
            alert("Gagal menghapus produk.");
        }
    }
}

function prepareEditProduct(id, p) {
    document.getElementById('productId').value = id;
    document.getElementById('prodName').value = p.name || '';
    document.getElementById('prodBrand').value = p.brand || '';
    document.getElementById('prodStoreName').value = p.storeName || '';
    document.getElementById('prodTags').value = (p.tags || []).join(', ');
    document.getElementById('prodImage').value = p.imageUrl || '';
    document.getElementById('prodAffiliate').value = p.affiliateLink || '';

    formTitle.textContent = "Edit Produk";
    submitBtn.textContent = "Perbarui Produk";
    cancelEditBtn.classList.remove('hidden');
    productForm.scrollIntoView({ behavior: 'smooth' });
}

cancelEditBtn.addEventListener('click', resetForm);

function resetForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    formTitle.textContent = "Tambah Produk Baru";
    submitBtn.textContent = "Simpan Produk";
    cancelEditBtn.classList.add('hidden');
}