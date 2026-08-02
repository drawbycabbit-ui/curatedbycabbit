// Import fungsi Firestore yang dibutuhkan
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Referensi elemen HTML
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');

let allProducts = []; // Menyimpan semua produk di memori untuk fitur search cepat

/**
 * Fungsi untuk memformat angka ke format Rupiah
 */
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

/**
 * Fungsi utama untuk mengambil data produk dari Firestore
 */
async function loadProducts() {
    try {
        // Mengambil semua dokumen dari collection 'products'
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        
        querySnapshot.forEach((doc) => {
            // Tambahkan ID dokumen ke data agar mudah diidentifikasi
            allProducts.push({ id: doc.id, ...doc.data() });
        });

        // Urutkan produk berdasarkan waktu pembuatan (terbaru di atas)
        allProducts.sort((a, b) => b.createdAt - a.createdAt);
        
        renderProducts(allProducts);
    } catch (error) {
        console.error("Gagal memuat produk:", error);
        productGrid.innerHTML = `<p class="col-span-full text-center text-accent">Gagal memuat produk. Periksa koneksi atau konfigurasi Firebase.</p>`;
    }
}

/**
 * Fungsi untuk me-render array produk ke dalam HTML
 */
function renderProducts(products) {
    productGrid.innerHTML = ''; // Bersihkan grid

    if (products.length === 0) {
        productGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">Produk tidak ditemukan.</p>`;
        return;
    }

    products.forEach(product => {
        // Hitung persentase diskon jika ada harga asli
        let discountHtml = '';
        let priceHtml = `<p class="text-lg font-bold text-secondary">${formatRupiah(product.price)}</p>`;
        
        if (product.originalPrice && product.originalPrice > product.price) {
            const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
            discountHtml = `<span class="discount-badge absolute top-2 left-2">-${discountPercent}%</span>`;
            priceHtml = `
                <p class="text-lg font-bold text-accent">${formatRupiah(product.price)}</p>
                <p class="text-sm text-gray-400 line-through">${formatRupiah(product.originalPrice)}</p>
            `;
        }

        // Buat elemen kartu produk
        const card = document.createElement('div');
        card.className = 'product-card bg-white rounded-xl overflow-hidden border border-gray-100 flex flex-col';
        card.innerHTML = `
            <div class="relative aspect-[3/4] overflow-hidden bg-gray-100">
                <img src="${product.imageUrl || 'https://via.placeholder.com/300x400?text=No+Image'}" 
                     alt="${product.name}" 
                     class="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                     onerror="this.src='https://via.placeholder.com/300x400?text=Image+Error'">
                ${discountHtml}
            </div>
            <div class="p-4 flex flex-col flex-grow">
                <p class="text-xs font-bold text-primary uppercase tracking-wider mb-1">${product.brand || 'Generic'}</p>
                <h3 class="font-brand font-semibold text-dark mb-2 line-clamp-2 flex-grow">${product.name}</h3>
                <div class="mb-4">
                    ${priceHtml}
                </div>
                <!-- Tombol Afiliasi: Membuka link di tab baru -->
                <a href="${product.affiliateLink}" target="_blank" rel="noopener noreferrer" 
                   class="w-full bg-primary hover:bg-opacity-90 text-white font-bold py-2.5 px-4 rounded-lg text-center transition flex items-center justify-center gap-2">
                    <span>Beli Sekarang</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </a>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

/**
 * Event Listener untuk fitur Pencarian (Real-time filtering)
 */
searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = allProducts.filter(product => 
        product.name.toLowerCase().includes(keyword) || 
        (product.brand && product.brand.toLowerCase().includes(keyword)) ||
        (product.category && product.category.toLowerCase().includes(keyword))
    );
    renderProducts(filtered);
});

// Jalankan fungsi saat halaman dimuat
loadProducts();