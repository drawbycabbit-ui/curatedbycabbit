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

// --- 1. MANAJEMEN AUTENTIKASI ---

// Listener status login: otomatis menyesuaikan tampilan UI
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User sudah login
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        loadAdminProducts(); // Muat data produk
    } else {
        // User belum login
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    }
});

// Handle proses Login
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

// Handle proses Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// --- 2. MANAJEMEN DATA PRODUK (CRUD) ---

/**
 * CREATE & UPDATE: Handle submit form produk
 */
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Ambil nilai dari form
    const id = document.getElementById('productId').value;
    const productData = {
        name: document.getElementById('prodName').value,
        brand: document.getElementById('prodBrand').value,
        imageUrl: document.getElementById('prodImage').value,
        affiliateLink: document.getElementById('prodAffiliate').value,
        updatedAt: serverTimestamp()
    };

    // Tambahkan createdAt hanya jika ini produk baru
    if (!id) {
        productData.createdAt = serverTimestamp();
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Menyimpan...";

        if (id) {
            // UPDATE: Jika ada ID, berarti mode edit
            await updateDoc(doc(db, "products", id), productData);
            alert("Produk berhasil diperbarui!");
        } else {
            // CREATE: Jika tidak ada ID, buat dokumen baru
            await addDoc(collection(db, "products"), productData);
            alert("Produk baru berhasil ditambahkan!");
        }

        resetForm();
        loadAdminProducts(); // Refresh tabel
    } catch (error) {
        console.error("Gagal menyimpan produk:", error);
        alert("Terjadi kesalahan saat menyimpan.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Simpan Produk";
    }
});

/**
 * READ: Muat dan tampilkan daftar produk di tabel admin
 */
async function loadAdminProducts() {
    adminProductList.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat data...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        adminProductList.innerHTML = ''; // Clear loading

        querySnapshot.forEach((doc) => {
            const p = doc.data();
            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition";
            row.innerHTML = `
                <td class="p-4"><img src="${p.imageUrl}" class="w-12 h-12 object-cover rounded bg-gray-200"></td>
                <td class="p-4">
                    <div class="font-semibold text-dark">${p.name}</div>
                    <div class="text-xs text-gray-500">${p.brand || '-'}</div>
                </td>
                <td class="p-4 text-right space-x-2">
                    <button onclick="window.editProduct('${doc.id}', '${encodeURIComponent(JSON.stringify(p))}')" 
                            class="text-primary hover:text-secondary font-semibold text-xs border border-primary px-2 py-1 rounded">Edit</button>
                    <button onclick="window.deleteProduct('${doc.id}')" 
                            class="text-accent hover:text-red-800 font-semibold text-xs border border-accent px-2 py-1 rounded">Hapus</button>
                </td>
            `;
            adminProductList.appendChild(row);
        });
    } catch (error) {
        console.error("Gagal memuat data:", error);
    }
}

/**
 * DELETE: Hapus produk dari Firestore
 */
window.deleteProduct = async (id) => {
    if (confirm("Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.")) {
        try {
            await deleteDoc(doc(db, "products", id));
            loadAdminProducts(); // Refresh tabel
        } catch (error) {
            console.error("Gagal menghapus:", error);
            alert("Gagal menghapus produk.");
        }
    }
};

/**
 * PREPARE EDIT: Isi form dengan data produk yang dipilih
 */
window.editProduct = (id, productString) => {
    const p = JSON.parse(decodeURIComponent(productString));
    
    document.getElementById('productId').value = id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodBrand').value = p.brand || '';
    document.getElementById('prodImage').value = p.imageUrl;
    document.getElementById('prodAffiliate').value = p.affiliateLink;

    // Ubah UI ke mode Edit
    formTitle.textContent = "Edit Produk";
    submitBtn.textContent = "Perbarui Produk";
    cancelEditBtn.classList.remove('hidden');
    
    // Scroll ke form
    productForm.scrollIntoView({ behavior: 'smooth' });
};

// Handle tombol batal edit
cancelEditBtn.addEventListener('click', resetForm);

/**
 * Utility: Reset form ke kondisi awal (mode tambah baru)
 */
function resetForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    formTitle.textContent = "Tambah Produk Baru";
    submitBtn.textContent = "Simpan Produk";
    cancelEditBtn.classList.add('hidden');
}