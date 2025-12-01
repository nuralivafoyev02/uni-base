// js/app.js

// 1. SUPABASE KONFIGURATSIYA (O'zingnikini qo'y!)
const SUPABASE_URL = 'https://kfainmhjhrayivuhbuud.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYWlubWhqaHJheWl2dWhidXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMTI2MjgsImV4cCI6MjA3OTg4ODYyOH0.ZePwB9I2NHndc9pO52ZTzy9QbfYWONJSa6Mj4o91wOA';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Variables
let currentUser = null;
let currentProfile = null;
let currentCategory = 'all'; 
let currentView = 'public';
let searchTimeout = null; // Debounce uchun

// --- INITIALIZATION ---
async function initApp() {
    renderSkeletons(6); 
    
    // Dark mode check
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-icon').setAttribute('data-lucide', 'sun');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-icon').setAttribute('data-lucide', 'moon');
    }

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
            
            const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
            
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

// --- DATA FETCHING (SEARCH BILAN) ---
async function loadMaterials(status = 'approved', searchQuery = '') {
    const grid = document.getElementById('materials-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const title = document.getElementById('section-title');

    // Sarlavhani o'zgartirish
    if (searchQuery) title.innerText = `Qidiruv natijalari: "${searchQuery}"`;
    else title.innerText = status === 'pending' ? 'Admin: Tekshiruvdagi fayllar' : (currentCategory === 'all' ? 'So\'nggi materiallar' : `${currentCategory.toUpperCase()} bo'limi`);
    
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

        // Kategoriya filtri
        if (status === 'approved' && currentCategory !== 'all') {
            query = query.eq('category', currentCategory);
        }

        // Qidiruv filtri (Title bo'yicha ilike)
        if (searchQuery) {
            query = query.ilike('title', `%${searchQuery}%`);
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
            
            // Fayl turini aniqlash va ikonka olish
            const { icon, color, typeLabel } = getFileIcon(item.file_url, item.title);

            const card = document.createElement('div');
            card.className = `bg-white dark:bg-slate-800 rounded-xl border ${isPremium ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-200 dark:border-gray-700'} shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between h-full animate-fade-in-up relative overflow-hidden group`;
            
            let badge = isPremium ? `<div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">PREMIUM</div>` : '';

            // Card Actions
            let actions = '';
            if (isAdminView) {
                actions = `
                    <div class="flex gap-2 mt-4">
                        <button onclick="approveFile(${item.id})" class="flex-1 bg-green-50 text-green-600 py-2 rounded-lg text-sm font-medium hover:bg-green-100">Tasdiqlash</button>
                        <button onclick="rejectFile(${item.id})" class="flex-1 bg-red-50 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100">Rad etish</button>
                        <a href="${item.file_url}" target="_blank" class="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg"><i data-lucide="eye" class="w-4 h-4"></i></a>
                    </div>`;
            } else {
                actions = `
                    <a href="${item.file_url}" target="_blank" class="mt-4 flex items-center justify-center gap-2 w-full ${isPremium ? 'bg-yellow-400 text-white hover:bg-yellow-500' : 'bg-primary text-white hover:bg-indigo-700'} py-2.5 rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-500/20 group-hover:-translate-y-1">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        ${isPremium ? 'Sotib olish' : 'Yuklab olish'}
                    </a>`;
            }

            card.innerHTML = `
                ${badge}
                <div class="relative">
                    <div class="flex items-start justify-between mb-4">
                        <div class="p-3 rounded-lg ${color} bg-opacity-10">
                            <i data-lucide="${icon}" class="w-6 h-6 ${color.replace('bg-', 'text-')}"></i>
                        </div>
                        <span class="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">${item.category}</span>
                    </div>
                    
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2 h-14" title="${item.title}">${item.title}</h3>
                    
                    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
                        <div class="flex items-center gap-1.5">
                            <div class="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                                <span class="text-[9px] font-bold">${email[0].toUpperCase()}</span>
                            </div>
                            <span class="truncate max-w-[80px]">${email.split('@')[0]}</span>
                        </div>
                        <span>${new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
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

// --- HELPER: FILE ICONS ---
function getFileIcon(url, title) {
    // URL yoki Title dan kengaytmani olish
    const ext = (url.split('.').pop().split('?')[0] || title.split('.').pop() || '').toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
        return { icon: 'image', color: 'bg-purple-500', typeLabel: 'Rasm' };
    } else if (['pdf'].includes(ext)) {
        return { icon: 'file-text', color: 'bg-red-500', typeLabel: 'PDF' };
    } else if (['doc', 'docx'].includes(ext)) {
        return { icon: 'file-type-2', color: 'bg-blue-500', typeLabel: 'Word' };
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
        return { icon: 'table', color: 'bg-green-500', typeLabel: 'Excel' };
    } else if (['ppt', 'pptx'].includes(ext)) {
        return { icon: 'presentation', color: 'bg-orange-500', typeLabel: 'PPT' };
    } else if (['zip', 'rar', '7z'].includes(ext)) {
        return { icon: 'folder-archive', color: 'bg-yellow-500', typeLabel: 'Arxiv' };
    } else {
        return { icon: 'file', color: 'bg-gray-500', typeLabel: 'Fayl' };
    }
}

// --- GLOBAL ACTIONS ---
window.setCategory = (cat) => {
    currentCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(btn => {
        // Light/Dark mode classes reset
        btn.className = "cat-btn px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary transition-all";
    });
    
    // Active button style
    const activeBtn = Array.from(document.querySelectorAll('.cat-btn')).find(b => b.getAttribute('onclick').includes(`'${cat}'`));
    if(activeBtn) {
        activeBtn.className = "cat-btn px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-white shadow-md transition-all";
    }

    if (currentView === 'admin') showPublicPanel();
    else loadMaterials('approved', document.getElementById('search-input').value);
};

// --- SEARCH HANDLER (DEBOUNCE) ---
window.handleSearch = (value) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadMaterials(currentView === 'admin' ? 'pending' : 'approved', value);
    }, 500); // 500ms kuting, keyin qidiring
};

// --- DARK MODE TOGGLE ---
window.toggleTheme = () => {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
        icon.setAttribute('data-lucide', 'moon');
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
        icon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
}

// --- UPLOAD HANDLER (BETTER UX) ---
const fileInput = document.getElementById('dropzone-file');
fileInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        const file = e.target.files[0];
        document.getElementById('file-name-display').innerHTML = `<span class="text-primary font-bold">${file.name}</span> <span class="text-xs text-gray-400">(${(file.size/1024/1024).toFixed(2)} MB)</span>`;
        document.getElementById('upload-icon').className = "w-8 h-8 text-primary mb-2";
    }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return showToast("Avval kiring!", "error");

    const btn = document.getElementById('upload-btn-text');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('upload-status-text');
    const percentText = document.getElementById('upload-percentage');

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner mr-2"></div> Yuklanmoqda...`;
    progressContainer.classList.remove('hidden');

    try {
        const file = fileInput.files[0];
        const title = document.getElementById('file-title').value;
        const category = document.getElementById('file-category').value;
        // Xavfsiz nom yaratish
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        // 1. Simulyatsiya qilingan progress (Chunki SupabaseJS oddiy mijozi progress qaytarmaydi)
        let progress = 0;
        const interval = setInterval(() => {
            if(progress < 90) {
                progress += Math.random() * 10;
                progressBar.style.width = `${progress}%`;
                percentText.innerText = `${Math.floor(progress)}%`;
            }
        }, 200);

        // 2. Real Upload
        statusText.innerText = "Serverga yuklanmoqda...";
        const { error: uploadError } = await sb.storage.from('files').upload(fileName, file);
        
        clearInterval(interval);
        if (uploadError) throw uploadError;

        progressBar.style.width = "100%";
        percentText.innerText = "100%";
        statusText.innerText = "Ma'lumotlar saqlanmoqda...";

        const { data: { publicUrl } } = sb.storage.from('files').getPublicUrl(fileName);

        // 3. Bazaga yozish
        const { error: dbError } = await sb.from('materials').insert({
            title, category, file_url: publicUrl, user_id: currentUser.id, status: 'pending'
        });
        if (dbError) throw dbError;

        showToast("Muvaffaqiyatli yuklandi! Admin tekshiradi.");
        window.closeModal('upload-modal');
        e.target.reset();
        
        // UI Reset
        document.getElementById('file-name-display').innerText = "Faylni tanlang";
        progressContainer.classList.add('hidden');
        progressBar.style.width = "0%";
        
    } catch (error) {
        showToast(error.message, "error");
        progressContainer.classList.add('hidden');
    } finally {
        btn.innerHTML = "Yuklash";
        btn.disabled = false;
    }
});

// --- STANDARD FUNCTIONS (Auth & Utils) ---
window.showAdminPanel = () => {
    currentView = 'admin';
    document.getElementById('admin-link').classList.add('hidden');
    document.getElementById('public-link').classList.remove('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    loadMaterials('pending', document.getElementById('search-input').value);
}

window.showPublicPanel = () => {
    currentView = 'public';
    document.getElementById('admin-link').classList.remove('hidden');
    document.getElementById('public-link').classList.add('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    loadMaterials('approved', document.getElementById('search-input').value);
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

function renderSkeletons(count) {
    const loader = document.getElementById('loader');
    loader.innerHTML = '';
    // Skeleton dark mode supported
    for(let i=0; i<count; i++) loader.innerHTML += `<div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm animate-pulse h-48"><div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div><div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div></div>`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const color = type === 'success' ? 'text-green-600 border-green-500 bg-green-50 dark:bg-green-900/20' : 'text-red-600 border-red-500 bg-red-50 dark:bg-red-900/20';
    toast.className = `border-l-4 shadow-xl rounded-r-lg p-4 flex items-center gap-3 min-w-[250px] transform transition-all translate-x-10 opacity-0 mb-2 backdrop-blur-md ${color}`;
    toast.innerHTML = `<p class="font-medium text-sm">${message}</p>`;
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