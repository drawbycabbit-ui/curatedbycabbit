/* Jika produk mencapai 1.000+, tambahkan optimasi ini di js/app.js untuk menghemat Firebase reads

// Tambahkan di awal file app.js - CACHING DI LOCALSTORAGE
const CACHE_KEY = 'affiliate_products_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

async function loadProducts() {
    // Cek cache dulu
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
        const { data, timestamp } = JSON.parse(cached);

        if (Date.now() - timestamp < CACHE_DURATION) {
            allProducts = data;
            extractUniqueValues();
            renderFilterOptions();
            applyFilters();
            return; // Skip Firebase call!
        }
    }

    // Jika cache expired, ambil dari Firebase
    const querySnapshot = await getDocs(collection(db, "products"));
    allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Simpan ke cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: allProducts,
        timestamp: Date.now()
    }));

    extractUniqueValues();
    renderFilterOptions();
    applyFilters();
}
*/

import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Referensi elemen HTML
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterStore = document.getElementById('filterStore');
const filterTag = document.getElementById('filterTag');
const resetFilterBtn = document.getElementById('resetFilterBtn');
const productCount = document.getElementById('productCount');

// Elemen baru untuk sorting produk
const sortSelect = document.getElementById('sortSelect');

let allProducts = [];       // Semua produk dari Firebase
let uniqueCategories = [];  // Daftar kategori unik untuk dropdown
let uniqueStores = [];      // Daftar toko unik untuk dropdown
let uniqueTags = [];        // Daftar tags unik untuk dropdown

// Mode sorting default
// Pilihan: newest | az | za | popular
let sortMode = 'newest';


// --- 1. HELPER KEAMANAN ---
// Helper: Mencegah XSS & SyntaxError
function escapeHTML(str) {
    if (!str) return '';

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// --- 2. AMBIL DATA DARI FIREBASE ---
/**
AMBIL DATA DARI FIREBASE
*/
async function loadProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));

        allProducts = [];

        querySnapshot.forEach((docSnap) => {
            allProducts.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        // Urutkan default berdasarkan terbaru
        // Sorting final akan dilakukan lagi di fungsi sortProducts()
        allProducts.sort((a, b) => {
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });

        // EKSTRAK data unik untuk filter
        extractUniqueValues();

        // Render dropdown filter
        renderFilterOptions();

        // Tampilkan semua produk
        applyFilters();

    } catch (error) {
        console.error("Gagal memuat produk:", error);

        productGrid.innerHTML = `
            <p class="col-span-full text-center text-accent">
                Gagal memuat produk. Silakan cek console.
            </p>
        `;
    }
}


// --- 3. EKSTRAK NILAI UNIK DARI DATA PRODUK ---
/**
EKSTRAK NILAI UNIK DARI DATA PRODUK
Fungsi ini mengambil semua kategori, toko, dan tags yang berbeda
*/
function extractUniqueValues() {
    const categoriesSet = new Set();
    const storesSet = new Set();
    const tagsSet = new Set();

    allProducts.forEach(p => {
        if (p.brand) categoriesSet.add(p.brand);
        if (p.storeName) storesSet.add(p.storeName);

        if (Array.isArray(p.tags)) {
            p.tags.forEach(tag => tagsSet.add(tag));
        }
    });

    // Ubah Set ke Array dan urutkan alfabetis
    uniqueCategories = [...categoriesSet].sort();
    uniqueStores = [...storesSet].sort();
    uniqueTags = [...tagsSet].sort();
}


// --- 4. RENDER DROPDOWN FILTER ---
/**
RENDER DROPDOWN FILTER
*/
function renderFilterOptions() {
    // Kategori
    filterCategory.innerHTML = '<option value="">Semua Kategori</option>';

    uniqueCategories.forEach(cat => {
        filterCategory.innerHTML += `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    });

    // Tema
    filterStore.innerHTML = '<option value="">Semua Tema</option>';

    uniqueStores.forEach(store => {
        filterStore.innerHTML += `<option value="${escapeHTML(store)}">${escapeHTML(store)}</option>`;
    });

    // Tags
    filterTag.innerHTML = '<option value="">Semua Tags</option>';

    uniqueTags.forEach(tag => {
        filterTag.innerHTML += `<option value="${escapeHTML(tag)}">#${escapeHTML(tag)}</option>`;
    });
}


// --- 5. SORTING PRODUK ---
/**
SORTING PRODUK

Mode sorting:
- newest  : produk terbaru berdasarkan createdAt
- az      : nama produk A-Z
- za      : nama produk Z-A
- popular : paling banyak diklik berdasarkan clickCount
*/
function getProductTime(product) {
    return product.createdAt?.seconds || product.updatedAt?.seconds || 0;
}

function sortProducts(products) {
    const sorted = [...products];

    switch (sortMode) {

        // Nama A-Z
        case 'az':
            sorted.sort((a, b) => {
                return (a.name || '').localeCompare(b.name || '', 'id', {
                    sensitivity: 'base'
                });
            });
            break;

        // Nama Z-A
        case 'za':
            sorted.sort((a, b) => {
                return (b.name || '').localeCompare(a.name || '', 'id', {
                    sensitivity: 'base'
                });
            });
            break;

        // Paling banyak diklik
        case 'popular':
            sorted.sort((a, b) => {
                const clickA = a.clickCount || 0;
                const clickB = b.clickCount || 0;

                // Jika jumlah klik sama, fallback ke produk terbaru
                if (clickB === clickA) {
                    return getProductTime(b) - getProductTime(a);
                }

                return clickB - clickA;
            });
            break;

        // Terbaru ditambahkan
        case 'newest':
        default:
            sorted.sort((a, b) => {
                return getProductTime(b) - getProductTime(a);
            });
            break;
    }

    return sorted;
}


// --- 6. TERAPKAN SEMUA FILTER ---
/**
TERAPKAN SEMUA FILTER (Search + Kategori + Toko + Tags + Sorting)
*/
function applyFilters() {
    const keyword = searchInput.value.toLowerCase().trim();
    const selectedCategory = filterCategory.value;
    const selectedStore = filterStore.value;
    const selectedTag = filterTag.value;

    const filtered = allProducts.filter(product => {

        // Filter 1: Nama produk mengandung keyword
        const matchKeyword = !keyword || (product.name || '').toLowerCase().includes(keyword);

        // Filter 2: Kategori cocok (jika dipilih)
        const matchCategory = !selectedCategory || product.brand === selectedCategory;

        // Filter 3: Nama toko cocok (jika dipilih)
        const matchStore = !selectedStore || product.storeName === selectedStore;

        // Filter 4: Tags mengandung tag yang dipilih (jika dipilih)
        const matchTag = !selectedTag || (Array.isArray(product.tags) && product.tags.includes(selectedTag));

        // Semua kondisi harus terpenuhi (AND logic)
        return matchKeyword && matchCategory && matchStore && matchTag;
    });

    // Terapkan sorting setelah filtering
    const sortedProducts = sortProducts(filtered);

    renderProducts(sortedProducts);

    // Update counter
    productCount.textContent = `Menampilkan ${sortedProducts.length} dari ${allProducts.length} produk`;
}


// --- 7. RENDER PRODUK KE HTML ---
/**
RENDER PRODUK KE HTML
*/
function renderProducts(products) {
    productGrid.innerHTML = '';

    if (products.length === 0) {
        productGrid.innerHTML = `
            <p class="col-span-full text-center text-gray-500 py-12">
                Tidak ada produk yang cocok dengan filter Anda.
            </p>
        `;
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card bg-white rounded-xl overflow-hidden border border-gray-100 flex flex-col';

        // Tampilkan tags sebagai badge di kartu produk
        const tagsHtml = (product.tags || []).slice(0, 3).map(tag =>
            `<span class="bg-light text-secondary text-xs px-2 py-0.5 rounded">#${escapeHTML(tag)}</span>`
        ).join('');

        card.innerHTML = `
            <div class="relative aspect-[3/4] overflow-hidden bg-gray-100">
                <img src="${escapeHTML(product.imageUrl) || 'https://via.placeholder.com/300x400?text=No+Image'}"
                     alt="${escapeHTML(product.name)}"
                     class="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                     onerror="this.src='https://via.placeholder.com/300x400?text=Image+Error'">
            </div>

            <div class="p-4 flex flex-col flex-grow">
                <p class="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    ${escapeHTML(product.brand) || 'Produk'}
                </p>

                <h3 class="font-brand font-semibold text-dark mb-1 line-clamp-2">
                    ${escapeHTML(product.name)}
                </h3>

                <!-- Tampilkan nama toko -->
                <p class="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    ${escapeHTML(product.storeName) || 'Tema'}
                </p>

                <!-- Tampilkan tags -->
                <div class="flex flex-wrap gap-1 mb-3 min-h-[24px]">
                    ${tagsHtml}
                </div>

                <!--
                Tombol affiliate diberi:
                - class affiliate-link untuk tracking klik
                - data-id untuk update clickCount di Firestore
                - data-name untuk event Google Analytics
                -->
                <a href="${escapeHTML(product.affiliateLink)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="affiliate-link mt-auto w-full bg-primary hover:bg-opacity-90 text-white font-bold py-2.5 px-4 rounded-lg text-center transition flex items-center justify-center gap-2"
                   data-id="${escapeHTML(product.id)}"
                   data-name="${escapeHTML(product.name)}">
                    <span>Cek Detail</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                </a>
            </div>
        `;

        productGrid.appendChild(card);
    });
}


// --- 8. EVENT LISTENERS ---
/**
EVENT LISTENERS - Semua filter trigger fungsi applyFilters()
*/
searchInput.addEventListener('input', applyFilters);
filterCategory.addEventListener('change', applyFilters);
filterStore.addEventListener('change', applyFilters);
filterTag.addEventListener('change', applyFilters);

// Dropdown sorting
if (sortSelect) {
    sortSelect.addEventListener('change', () => {
        sortMode = sortSelect.value;
        applyFilters();
    });
}

// Reset semua filter
resetFilterBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterCategory.value = '';
    filterStore.value = '';
    filterTag.value = '';

    applyFilters();
});


// --- 9. TRACKING KLIK AFFILIATE ---
/**
TRACKING KLIK AFFILIATE

Fungsi ini melakukan 2 hal:
1. Mengirim event ke Google Analytics jika tersedia
2. Menambah field clickCount di Firestore untuk sorting "Most Clickable"

Catatan:
- Fitur clickCount membutuhkan izin update terbatas di Firestore Rules.
- Jika Anda tidak ingin visitor melakukan write sama sekali, bagian ini bisa dihapus.
*/
productGrid.addEventListener('click', async (e) => {
    const link = e.target.closest('a.affiliate-link');
    if (!link) return;

    const productId = link.dataset.id || '';
    const productName = link.dataset.name || '';

    // Kirim event ke Google Analytics jika gtag tersedia
    if (typeof gtag === 'function') {
        gtag('event', 'affiliate_click', {
            product_id: productId,
            product_name: productName,
            link_url: link.href
        });
    }

    if (!productId) return;

    /**
     * Opsional: mencegah write berulang dalam satu sesi.
     * Ini membantu menghemat kuota write Firebase.
     * Jika ingin mencatat setiap klik, hapus bagian sessionStorage ini.
     */
    const clickKey = `affiliate_click_${productId}`;

    try {
        if (sessionStorage.getItem(clickKey)) return;
        sessionStorage.setItem(clickKey, '1');
    } catch (error) {
        // Jika sessionStorage tidak tersedia, tetap lanjut mencatat klik
        console.warn("sessionStorage tidak tersedia:", error);
    }

    try {
        await updateDoc(doc(db, "products", productId), {
            clickCount: increment(1)
        });

        // Update data lokal agar sorting popular langsung terasa tanpa reload
        const product = allProducts.find(p => p.id === productId);

        if (product) {
            product.clickCount = (product.clickCount || 0) + 1;
        }

        // Jika sedang memakai sorting popular, refresh urutan
        if (sortMode === 'popular') {
            applyFilters();
        }

    } catch (error) {
        console.error("Gagal mencatat klik affiliate:", error);
    }
});


// Jalankan saat halaman dimuat
loadProducts();