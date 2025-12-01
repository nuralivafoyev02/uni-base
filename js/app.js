// js/app.js

// 1. SUPABASE KONFIGURATSIYA (O'zingnikini qo'y!)
const SUPABASE_URL = 'https://kfainmhjhrayivuhbuud.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYWlubWhqaHJheWl2dWhidXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMTI2MjgsImV4cCI6MjA3OTg4ODYyOH0.ZePwB9I2NHndc9pO52ZTzy9QbfYWONJSa6Mj4o91wOA';

// XATONI TO'G'IRLASH: O'zgaruvchi nomini 'sb' ga o'zgartirdik
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Variables
let currentUser = null;
let currentProfile = null;
let currentCategory = 'all'; 
let currentView = 'public';

// --- INITIALIZATION ---
async function initApp() {
    renderSkeletons(6); 
    lucide.createIcons();
    
    try {
        const { data: { user } } = await sb.auth.getUser();
        currentUser = user;

        const authLoading = document.getElementById('auth-loading');
        const guestView = document.getElementById('guest-view');
        const userView = document.getElementById('user-view');

        authLoading.classList.add('hidden');

        if (user) {
            userView.classList.remove('hidden');
            guestView.classList.add('hidden');
            
            // Profilni olish
            const { data: profile, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
            
            if (profile) {
                currentProfile = profile;
                document.getElementById('user-email-display').innerText = user.email;
                document.getElementById('user-points').innerText = profile.points || 0;
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${user.email}&background=random&color=fff`;

                if (profile.role === 'admin') {
                    document.getElementById('admin-link').classList.remove('hidden');
                }
            }
        } else {
            guestView.classList.remove('hidden');
            userView.classList.add('hidden');
        }
        loadMaterials();
    } catch (err) {
        console.error("Init Error:", err);
        document.getElementById('auth-loading').classList.add('hidden');
        document.getElementById('guest-view').classList.remove('hidden');
    }
}

// --- DATA FETCHING ---
async function loadMaterials(status = 'approved') {
    const grid = document.getElementById('materials-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const title = document.getElementById('section-title');

    title.innerText = status === 'pending' ? 'Admin: Tekshiruvdagi fayllar' : (currentCategory === 'all' ? 'So\'nggi materiallar' : `${currentCategory.toUpperCase()} bo'limi`);
    
    grid.classList.add('hidden');
    emptyState.classList.add('hidden');
    loader.classList.remove('hidden');
    renderSkeletons(6);
    
    try {
        let query = sb
            .from('materials')
            .select('*, profiles(email)')
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (status === 'approved' && currentCategory !== 'all') {
            query = query.eq('category', currentCategory);
        }

        const { data, error } = await query;
        loader.classList.add('hidden');
        
        if (error) throw error;
        if (!data || data.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        grid.innerHTML = '';

        data.forEach(item => {
            const isPremium = item.is_paid;
            const isAdminView = status === 'pending';
            const email = item.profiles ? item.profiles.email : 'Anonim';
            
            const card = document.createElement('div');
            card.className = `bg-white rounded-xl border ${isPremium ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-200'} shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between h-full animate-fade-in-up relative overflow-hidden`;
            
            let badge = isPremium ? `<div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">PREMIUM</div>` : '';

            let actions = '';
            if (isAdminView) {
                actions = `
                    <div class="flex gap-2 mt-4">
                        <button onclick="approveFile(${item.id})" class="flex-1 bg-green-50 text-green-600 py-2 rounded-lg text-sm font-medium hover:bg-green-100">Tasdiqlash</button>
                        <button onclick="rejectFile(${item.id})" class="flex-1 bg-red-50 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100">Rad etish</button>
                        <a href="${item.file_url}" target="_blank" class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg"><i data-lucide="eye" class="w-4 h-4"></i></a>
                    </div>`;
            } else {
                actions = `
                    <a href="${item.file_url}" target="_blank" class="mt-4 block w-full text-center ${isPremium ? 'bg-yellow-400 text-white hover:bg-yellow-500' : 'bg-primary text-white hover:bg-indigo-700'} py-2.5 rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20">
                        ${isPremium ? 'Sotib olish' : 'Yuklab olish'}
                    </a>`;
            }

            card.innerHTML = `
                ${badge}
                <div>
                    <div class="flex items-center gap-2 mb-3">
                        <span class="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-0.5 rounded">${item.category.toUpperCase()}</span>
                        <span class="text-xs text-gray-400">${new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 leading-tight mb-1 line-clamp-2">${item.title}</h3>
                    <p class="text-sm text-gray-500 mb-4 flex items-center gap-1">
                        <i data-lucide="user" class="w-3 h-3"></i> ${email.split('@')[0]}
                    </p>
                </div>
                ${actions}
            `;
            grid.appendChild(card);
        });
        lucide.createIcons();

    } catch (err) {
        showToast("Yuklashda xatolik: " + err.message, "error");
    }
}

// --- GLOBAL ACTIONS (Window ga biriktiramiz) ---
window.setCategory = (cat) => {
    currentCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('bg-white', 'text-gray-600');
    });
    // Visual feedback qo'shmadik (HTML da statik), lekin logika ishlaydi
    if (currentView === 'admin') showPublicPanel();
    else loadMaterials('approved');
};

window.showAdminPanel = () => {
    currentView = 'admin';
    document.getElementById('admin-link').classList.add('hidden');
    document.getElementById('public-link').classList.remove('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    loadMaterials('pending');
}

window.showPublicPanel = () => {
    currentView = 'public';
    document.getElementById('admin-link').classList.remove('hidden');
    document.getElementById('public-link').classList.add('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    loadMaterials('approved');
}

window.approveFile = async (id) => {
    const { error } = await sb.from('materials').update({ status: 'approved' }).eq('id', id);
    if(error) showToast(error.message, "error");
    else { showToast("Tasdiqlandi!"); loadMaterials('pending'); }
}

window.rejectFile = async (id) => {
    if(!confirm("O'chirasizmi?")) return;
    await sb.from('materials').delete().eq('id', id);
    showToast("Rad etildi");
    loadMaterials('pending');
}

window.logoutUser = async () => {
    await sb.auth.signOut();
    location.reload();
}

window.toggleDropdown = () => {
    document.getElementById('user-dropdown').classList.toggle('hidden');
}

// --- AUTH HANDLERS ---
window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if(error) showToast(error.message, "error");
    else location.reload();
}

window.handleRegister = async () => {
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const { error } = await sb.auth.signUp({ email, password: pass });
    if(error) showToast(error.message, "error");
    else showToast("Emailingizni tasdiqlang!");
}

// --- UPLOAD HANDLERS ---
const fileInput = document.getElementById('dropzone-file');
fileInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        document.getElementById('file-name-display').innerText = e.target.files[0].name;
    }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return showToast("Avval kiring!", "error");

    const btn = document.getElementById('upload-btn-text');
    btn.innerText = "Yuklanmoqda...";
    btn.disabled = true;

    try {
        const file = fileInput.files[0];
        const title = document.getElementById('file-title').value;
        const category = document.getElementById('file-category').value;
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        
        const { error: uploadError } = await sb.storage.from('files').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = sb.storage.from('files').getPublicUrl(fileName);

        const { error: dbError } = await sb.from('materials').insert({
            title, category, file_url: publicUrl, user_id: currentUser.id, status: 'pending'
        });
        if (dbError) throw dbError;

        showToast("Yuklandi! Admin tekshiradi.");
        window.closeModal('upload-modal');
        e.target.reset();
        
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        btn.innerText = "Yuklash";
        btn.disabled = false;
    }
});

// --- HELPERS ---
function renderSkeletons(count) {
    const loader = document.getElementById('loader');
    loader.innerHTML = '';
    for(let i=0; i<count; i++) loader.innerHTML += `<div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse h-48"><div class="h-4 bg-gray-200 rounded w-1/3 mb-4"></div><div class="h-6 bg-gray-200 rounded w-3/4 mb-2"></div></div>`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const color = type === 'success' ? 'text-green-600 border-green-500' : 'text-red-600 border-red-500';
    toast.className = `bg-white border-l-4 shadow-xl rounded-r-lg p-4 flex items-center gap-3 min-w-[250px] transform transition-all translate-x-10 opacity-0 mb-2 ${color}`;
    toast.innerHTML = `<p class="font-medium text-gray-800">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-10', 'opacity-0'), 100);
    setTimeout(() => toast.remove(), 3000);
}

// Modals
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.onclick = function(event) {
    if (!event.target.closest('#user-view')) document.getElementById('user-dropdown').classList.add('hidden');
}

// Start
initApp();