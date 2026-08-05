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

const adminSearchInput = document.getElementById('adminSearchInput');
const adminFilterCategory = document.getElementById('adminFilterCategory');
const adminFilterStore = document.getElementById('adminFilterStore');
const adminFilterTag = document.getElementById('adminFilterTag');
const adminResetFilterBtn = document.getElementById('adminResetFilterBtn');
const adminProductCount = document.getElementById('adminProductCount');

// Cache untuk menyimpan data produk sementara agar tidak perlu parse JSON lagi
let productsCache = {};
let adminProducts = [];
let adminUniqueCategories = [];
let adminUniqueStores = [];
let adminUniqueTags = [];

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

    if (!id) {
		productData.createdAt = serverTimestamp();
		productData.clickCount = 0;
	}

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
  productsCache = {};
  adminProducts = [];

  try {
    const querySnapshot = await getDocs(collection(db, "products"));

    querySnapshot.forEach((docSnap) => {
      const p = { id: docSnap.id, ...docSnap.data() };
      productsCache[p.id] = p;
      adminProducts.push(p);
    });

    // Urutkan produk admin dari yang terbaru
    adminProducts.sort((a, b) => getAdminTime(b) - getAdminTime(a));

    // Ekstrak kategori, toko, dan tags untuk dropdown filter
    extractAdminUniqueValues();

    // Render dropdown filter
    renderAdminFilterOptions();

    // Tampilkan tabel sesuai filter aktif
    applyAdminFilters();

  } catch (error) {
    console.error("Gagal memuat data:", error);
    adminProductList.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Gagal memuat data.</td></tr>';
  }
}

function getAdminTime(product) {
  return product.createdAt?.seconds || product.updatedAt?.seconds || 0;
}

/**
 * Ekstrak kategori/brand, toko, dan tags unik untuk filter admin
 */
function extractAdminUniqueValues() {
  const categoriesSet = new Set();
  const storesSet = new Set();
  const tagsSet = new Set();

  adminProducts.forEach(p => {
    if (p.brand) categoriesSet.add(p.brand);
    if (p.storeName) storesSet.add(p.storeName);

    if (Array.isArray(p.tags)) {
      p.tags.forEach(tag => tagsSet.add(tag));
    }
  });

  adminUniqueCategories = [...categoriesSet].sort();
  adminUniqueStores = [...storesSet].sort();
  adminUniqueTags = [...tagsSet].sort();
}

/**
 * Render dropdown filter admin
 */
function renderAdminFilterOptions() {
  if (!adminFilterCategory || !adminFilterStore || !adminFilterTag) return;

  const currentCategory = adminFilterCategory.value;
  const currentStore = adminFilterStore.value;
  const currentTag = adminFilterTag.value;

  // Kategori
  adminFilterCategory.innerHTML = '<option value="">Semua Kategori</option>';
  adminUniqueCategories.forEach(cat => {
    adminFilterCategory.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`
    );
  });

  // Toko
  adminFilterStore.innerHTML = '<option value="">Semua Toko</option>';
  adminUniqueStores.forEach(store => {
    adminFilterStore.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHTML(store)}">${escapeHTML(store)}</option>`
    );
  });

  // Tags
  adminFilterTag.innerHTML = '<option value="">Semua Tags</option>';
  adminUniqueTags.forEach(tag => {
    adminFilterTag.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHTML(tag)}">#${escapeHTML(tag)}</option>`
    );
  });

  // Pertahankan pilihan filter sebelumnya jika masih valid
  setAdminSelectValue(adminFilterCategory, currentCategory);
  setAdminSelectValue(adminFilterStore, currentStore);
  setAdminSelectValue(adminFilterTag, currentTag);
}

/**
 * Helper untuk mempertahankan selected value dropdown setelah opsi dirender ulang
 */
function setAdminSelectValue(selectEl, value) {
  if (!selectEl || !value) return;

  const optionExists = [...selectEl.options].some(option => option.value === value);
  if (optionExists) {
    selectEl.value = value;
  }
}

/**
 * Terapkan search + filter kategori + toko + tags di admin
 */
function applyAdminFilters() {
  // Jika elemen filter belum ditambahkan di HTML, tampilkan semua produk
  if (!adminSearchInput || !adminFilterCategory || !adminFilterStore || !adminFilterTag) {
    renderAdminTable(adminProducts);
    return;
  }

  const keyword = adminSearchInput.value.toLowerCase().trim();
  const selectedCategory = adminFilterCategory.value;
  const selectedStore = adminFilterStore.value;
  const selectedTag = adminFilterTag.value;

  const filtered = adminProducts.filter(product => {
    const matchKeyword = !keyword || (product.name || '').toLowerCase().includes(keyword);
    const matchCategory = !selectedCategory || product.brand === selectedCategory;
    const matchStore = !selectedStore || product.storeName === selectedStore;
    const matchTag = !selectedTag || (Array.isArray(product.tags) && product.tags.includes(selectedTag));

    return matchKeyword && matchCategory && matchStore && matchTag;
  });

  renderAdminTable(filtered);

  if (adminProductCount) {
    adminProductCount.textContent = `Menampilkan ${filtered.length} dari ${adminProducts.length} produk`;
  }
}

/**
 * Render tabel produk admin
 */
function renderAdminTable(products) {
  adminProductList.innerHTML = '';

  if (!products.length) {
    adminProductList.innerHTML = `
      <tr>
        <td colspan="5" class="p-4 text-center text-gray-500">
          Tidak ada produk yang cocok dengan filter Anda.
        </td>
      </tr>
    `;
    return;
  }

  products.forEach(p => {
    const row = document.createElement('tr');
    row.className = "hover:bg-gray-50 transition";

    row.innerHTML = `
      <td class="p-4">
        <img src="${escapeHTML(p.imageUrl)}"
             class="w-12 h-12 object-cover rounded bg-gray-200"
             onerror="this.src='https://via.placeholder.com/48'">
      </td>

      <td class="p-4">
        <div class="font-semibold text-dark">${escapeHTML(p.name)}</div>
        <div class="text-xs text-gray-500">${escapeHTML(p.brand || '-')}</div>
        <div class="text-[11px] text-gray-400 mt-1">
          Klik: ${p.clickCount || 0}
        </div>
      </td>

      <td class="p-4 text-sm">
        ${escapeHTML(p.storeName || '-')}
      </td>

      <td class="p-4">
        <div class="flex flex-wrap gap-1">
          ${(p.tags || []).map(tag =>
            `<span class="bg-light text-secondary text-xs px-2 py-0.5 rounded">${escapeHTML(tag)}</span>`
          ).join('')}
        </div>
      </td>

      <td class="p-4 text-right space-x-2">
        <button class="edit-btn text-primary hover:text-secondary font-semibold text-xs border border-primary px-2 py-1 rounded"
                data-id="${escapeHTML(p.id)}">
          Edit
        </button>

        <button class="delete-btn text-accent hover:text-red-800 font-semibold text-xs border border-accent px-2 py-1 rounded"
                data-id="${escapeHTML(p.id)}">
          Hapus
        </button>
      </td>
    `;

    adminProductList.appendChild(row);
  });
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

/**
 * Event listeners filter admin
 */
if (adminSearchInput) {
  adminSearchInput.addEventListener('input', applyAdminFilters);
}

if (adminFilterCategory) {
  adminFilterCategory.addEventListener('change', applyAdminFilters);
}

if (adminFilterStore) {
  adminFilterStore.addEventListener('change', applyAdminFilters);
}

if (adminFilterTag) {
  adminFilterTag.addEventListener('change', applyAdminFilters);
}

if (adminResetFilterBtn) {
  adminResetFilterBtn.addEventListener('click', () => {
    adminSearchInput.value = '';
    adminFilterCategory.value = '';
    adminFilterStore.value = '';
    adminFilterTag.value = '';
    applyAdminFilters();
  });
}

function resetForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    formTitle.textContent = "Tambah Produk Baru";
    submitBtn.textContent = "Simpan Produk";
    cancelEditBtn.classList.add('hidden');
}