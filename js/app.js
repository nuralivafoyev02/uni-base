// js/app.js

// 1. SUPABASE KONFIGURATSIYA
const SUPABASE_URL = 'https://kfainmhjhrayivuhbuud.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYWlubWhqaHJheWl2dWhidXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMTI2MjgsImV4cCI6MjA3OTg4ODYyOH0.ZePwB9I2NHndc9pO52ZTzy9QbfYWONJSa6Mj4o91wOA';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Variables
let currentUser = null;
let currentProfile = null;
let currentCategory = 'all'; 
let currentView = 'public';
let searchTimeout = null; 
let statsChartInstance = null;

// --- INITIALIZATION ---
async function initApp() {
    renderSkeletons(6); 
    
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

// --- DATA FETCHING (UPDATED WITH RANKS) ---
async function loadMaterials(status = 'approved', searchQuery = '') {
    const grid = document.getElementById('materials-grid');
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const title = document.getElementById('section-title');

    if (currentView !== 'admin' || status === 'pending') {
         if (searchQuery) title.innerText = `Qidiruv natijalari: "${searchQuery}"`;
         else title.innerText = status === 'pending' ? 'Admin: Tekshiruvdagi fayllar' : (currentCategory === 'all' ? 'So\'nggi materiallar' : `${currentCategory.toUpperCase()} bo'limi`);
    }
    
    if(currentView === 'admin' && status !== 'pending') {
        grid.classList.add('hidden');
        return;
    }

    grid.classList.add('hidden');
    emptyState.classList.add('hidden');
    loader.classList.remove('hidden');
    renderSkeletons(6);
    
    try {
        // MUHIM: profiles ichidan 'points' ni ham olamiz (Unvonni aniqlash uchun)
        let query = sb
            .from('materials')
            .select('*, profiles(email, points)')
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (status === 'approved' && currentCategory !== 'all') {
            query = query.eq('category', currentCategory);
        }

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
            const { icon, color } = getFileIcon(item.file_url, item.title);

            // Foydalanuvchi Rankini aniqlash
            const uPoints = item.profiles ? (item.profiles.points || 0) : 0;
            const uRank = getUserRank(uPoints);

            const card = document.createElement('div');
            card.className = `bg-white dark:bg-slate-800 rounded-xl border ${isPremium ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-200 dark:border-gray-700'} shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between h-full animate-fade-in-up relative overflow-hidden group`;
            
            let badge = isPremium ? `<div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">PREMIUM</div>` : '';

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

            // HTML ichida User Rankni chiqarish
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
                            <div class="flex flex-col">
                                <span class="truncate max-w-[80px] font-medium text-gray-700 dark:text-gray-300">${email.split('@')[0]}</span>
                                <span class="text-[8px] font-bold" style="color: ${uRank.color}">${uRank.title}</span>
                            </div>
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
        btn.className = "cat-btn px-4 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary transition-all";
    });
    const activeBtn = Array.from(document.querySelectorAll('.cat-btn')).find(b => b.getAttribute('onclick').includes(`'${cat}'`));
    if(activeBtn) {
        activeBtn.className = "cat-btn px-4 py-1.5 rounded-full text-sm font-medium bg-primary text-white shadow-md transition-all";
    }

    if (currentView === 'admin') showPublicPanel();
    else loadMaterials('approved', document.getElementById('search-input').value);
};

window.handleSearch = (value) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadMaterials(currentView === 'admin' ? 'pending' : 'approved', value);
    }, 500);
};

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

// --- UPLOAD HANDLER ---
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        let progress = 0;
        const interval = setInterval(() => {
            if(progress < 90) {
                progress += Math.random() * 10;
                progressBar.style.width = `${progress}%`;
                percentText.innerText = `${Math.floor(progress)}%`;
            }
        }, 200);

        statusText.innerText = "Serverga yuklanmoqda...";
        const { error: uploadError } = await sb.storage.from('files').upload(fileName, file);
        
        clearInterval(interval);
        if (uploadError) throw uploadError;

        progressBar.style.width = "100%";
        percentText.innerText = "100%";
        statusText.innerText = "Ma'lumotlar saqlanmoqda...";

        const { data: { publicUrl } } = sb.storage.from('files').getPublicUrl(fileName);

        const { error: dbError } = await sb.from('materials').insert({
            title, category, file_url: publicUrl, user_id: currentUser.id, status: 'pending'
        });
        if (dbError) throw dbError;

        showToast("Muvaffaqiyatli yuklandi! Admin tekshiradi.");
        window.closeModal('upload-modal');
        e.target.reset();
        
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

// --- ADMIN PANEL FUNCTIONS ---
window.switchAdminTab = (tabName) => {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('bg-primary', 'text-white');
            btn.classList.remove('text-gray-500', 'dark:text-gray-400');
        } else {
            btn.classList.remove('bg-primary', 'text-white');
            btn.classList.add('text-gray-500', 'dark:text-gray-400');
        }
    });

    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    document.getElementById('materials-grid').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('loader').classList.add('hidden');
    
    if (tabName === 'dashboard') {
        document.getElementById('section-title').innerText = "Admin Dashboard";
        document.getElementById('admin-view-dashboard').classList.remove('hidden');
        loadDashboardStats();
    } else if (tabName === 'users') {
        document.getElementById('section-title').innerText = "Foydalanuvchilar Boshqaruvi";
        document.getElementById('admin-view-users').classList.remove('hidden');
        loadUsersList();
    } else if (tabName === 'logs') {
        document.getElementById('section-title').innerText = "Tizim Tarixi (Logs)";
        document.getElementById('admin-view-logs').classList.remove('hidden');
        loadAdminLogs();
    } else if (tabName === 'pending') {
        document.getElementById('section-title').innerText = "Tekshiruvdagi fayllar";
        loadMaterials('pending');
    }
};

async function loadDashboardStats() {
    try {
        const { data, error } = await sb.rpc('get_dashboard_stats');
        if (error) throw error;

        document.getElementById('stat-users').innerText = data.users;
        document.getElementById('stat-files').innerText = data.files;
        document.getElementById('stat-pending').innerText = data.pending;

        const ctx = document.getElementById('statsChart').getContext('2d');
        if (statsChartInstance) statsChartInstance.destroy();

        statsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Tasdiqlangan', 'Kutilmoqda'],
                datasets: [{
                    data: [data.files, data.pending],
                    backgroundColor: ['#4F46E5', '#EAB308'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: document.documentElement.classList.contains('dark') ? '#fff' : '#333' } }
                }
            }
        });
    } catch (err) {
        console.error("Stats Error:", err);
    }
}

async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Yuklanmoqda...</td></tr>';
    const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) return showToast("Xatolik: " + error.message, "error");
    tbody.innerHTML = '';
    users.forEach(user => {
        const isBanned = user.is_banned;
        const row = `
            <tr class="bg-white border-b dark:bg-slate-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                <td class="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <img src="https://ui-avatars.com/api/?name=${user.email}&background=random&color=fff&size=32" class="rounded-full w-6 h-6">
                    ${user.email}
                </td>
                <td class="px-6 py-4">${user.points || 0}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 text-xs rounded ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}">${user.role}</span></td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 text-xs rounded ${isBanned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">
                        ${isBanned ? 'BLOCKED' : 'ACTIVE'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${user.id !== currentUser.id ? `
                    <button onclick="toggleBan('${user.id}', ${isBanned}, '${user.email}')" class="font-medium ${isBanned ? 'text-green-600 hover:underline' : 'text-red-600 hover:underline'}">
                        ${isBanned ? 'Ochish' : 'Bloklash'}
                    </button>` : '<span class="text-gray-400 text-xs">Siz</span>'}
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

async function loadAdminLogs() {
    const list = document.getElementById('logs-list');
    list.innerHTML = '<li class="p-4 text-center">Yuklanmoqda...</li>';
    const { data: logs, error } = await sb.from('admin_logs').select('*, profiles(email)').order('created_at', { ascending: false }).limit(50);
    if (error) return showToast(error.message, "error");
    list.innerHTML = '';
    logs.forEach(log => {
        const item = `
            <li class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                <div class="flex items-center space-x-4">
                    <div class="flex-shrink-0">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-primary">
                            <i data-lucide="activity" class="w-4 h-4"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                            ${log.action} <span class="text-gray-500 dark:text-gray-400 font-normal">→ ${log.target_text || 'Noma\'lum'}</span>
                        </p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            Admin: ${log.profiles ? log.profiles.email : 'Tizim'} • ${new Date(log.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>
            </li>
        `;
        list.innerHTML += item;
    });
    lucide.createIcons();
}

async function logAction(action, target) {
    await sb.from('admin_logs').insert({ admin_id: currentUser.id, action: action, target_text: target });
}

window.toggleBan = async (userId, currentStatus, email) => {
    if(!confirm(currentStatus ? "Blokdan chiqarilsinmi?" : "Haqiqatan ham bloklaysizmi?")) return;
    const { error } = await sb.from('profiles').update({ is_banned: !currentStatus }).eq('id', userId);
    if(error) showToast(error.message, "error");
    else {
        showToast(currentStatus ? "Foydalanuvchi ochildi" : "Foydalanuvchi bloklandi");
        await logAction(currentStatus ? "User UNBANNED" : "User BANNED", email);
        loadUsersList();
    }
}

window.approveFile = async (id) => {
    const { data } = await sb.from('materials').select('title, user_id').eq('id', id).single();
    const { error } = await sb.from('materials').update({ status: 'approved' }).eq('id', id);
    if(error) showToast(error.message, "error");
    else { 
        showToast("Tasdiqlandi!");
        if (data && data.user_id) {
             const { data: profile } = await sb.from('profiles').select('points').eq('id', data.user_id).single();
             if (profile) await sb.from('profiles').update({ points: (profile.points || 0) + 5 }).eq('id', data.user_id);
        }
        await logAction("File APPROVED", data ? data.title : `ID: ${id}`);
        if(currentView === 'admin') loadMaterials('pending');
    }
}

window.rejectFile = async (id) => {
    const { data } = await sb.from('materials').select('title, file_url').eq('id', id).single();
    if(!confirm("Rad etib, o'chirib yuborasizmi?")) return;
    if(data && data.file_url) {
        const path = data.file_url.split('/files/')[1]; 
        if(path) await sb.storage.from('files').remove([path]);
    }
    const { error } = await sb.from('materials').delete().eq('id', id);
    if(error) showToast(error.message, "error");
    else {
        showToast("Rad etildi");
        await logAction("File REJECTED", data ? data.title : `ID: ${id}`);
        if(currentView === 'admin') loadMaterials('pending');
    }
}

window.showAdminPanel = () => {
    currentView = 'admin';
    document.getElementById('admin-link').classList.add('hidden');
    document.getElementById('public-link').classList.remove('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    document.getElementById('admin-nav').classList.remove('hidden'); 
    switchAdminTab('dashboard');
}

window.showPublicPanel = () => {
    currentView = 'public';
    document.getElementById('admin-link').classList.remove('hidden');
    document.getElementById('public-link').classList.add('hidden');
    document.getElementById('user-dropdown').classList.add('hidden');
    document.getElementById('admin-nav').classList.add('hidden');
    document.querySelectorAll('.admin-view').forEach(el => el.classList.add('hidden'));
    loadMaterials('approved');
}

// --- AUTH ---
window.logoutUser = async () => { await sb.auth.signOut(); location.reload(); }
window.toggleDropdown = () => { document.getElementById('user-dropdown').classList.toggle('hidden'); }
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

// --- UTILS ---
function renderSkeletons(count) {
    const loader = document.getElementById('loader');
    loader.innerHTML = '';
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

window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.onclick = function(event) {
    if (!event.target.closest('#user-view')) document.getElementById('user-dropdown').classList.add('hidden');
}

// --- YANGI: KARYERA TIZIMI LOGIKASI ---

function getUserRank(points) {
    points = points || 0;
    if (points >= 2500) return { title: 'AKADEMIK', class: 'bg-cyan-100 text-cyan-700 border-cyan-300', icon: 'diamond', color: '#06b6d4' };
    if (points >= 1000) return { title: 'PROFESSOR', class: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: 'crown', color: '#eab308' };
    if (points >= 600)  return { title: 'DOKTORANT', class: 'bg-red-100 text-red-700 border-red-300', icon: 'award', color: '#ef4444' };
    if (points >= 300)  return { title: 'MAGISTR',   class: 'bg-purple-100 text-purple-700 border-purple-300', icon: 'book-open-check', color: '#a855f7' };
    if (points >= 100)  return { title: 'BAKALAVR',  class: 'bg-green-100 text-green-700 border-green-300', icon: 'graduation-cap', color: '#22c55e' };
    if (points >= 20)   return { title: 'TALABA',    class: 'bg-blue-100 text-blue-700 border-blue-300', icon: 'user', color: '#3b82f6' };
    return { title: 'ABITURIYENT', class: 'bg-gray-100 text-gray-600 border-gray-300', icon: 'user-minus', color: '#9ca3af' };
}

window.openLeaderboard = async () => {
    openModal('leaderboard-modal');
    const list = document.getElementById('leaderboard-list');
    
    if(currentProfile) {
        const myRank = getUserRank(currentProfile.points);
        document.getElementById('my-points-display').innerHTML = `
            ${currentProfile.points || 0} <span class="text-xs text-gray-400">(${myRank.title})</span>
        `;
    }

    list.innerHTML = '<div class="flex justify-center py-10"><div class="spinner border-primary"></div></div>';

    const { data: users, error } = await sb
        .from('profiles')
        .select('*')
        .order('points', { ascending: false })
        .limit(20);

    if (error) {
        list.innerHTML = `<p class="text-center text-red-500 text-sm">Xatolik...</p>`;
        return;
    }

    list.innerHTML = '';
    
    users.forEach((user, index) => {
        const rank = getUserRank(user.points);
        let medal = `<span class="font-bold text-gray-400 text-sm ml-2">#${index + 1}</span>`;
        let borderClass = 'border-transparent';

        if (index === 0) { medal = '🥇'; borderClass = 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'; }
        else if (index === 1) { medal = '🥈'; }
        else if (index === 2) { medal = '🥉'; }

        const safeName = user.email.split('@')[0];

        const item = `
            <div class="flex items-center justify-between p-3 rounded-xl border ${borderClass} bg-white dark:bg-slate-700/50 hover:shadow-md transition mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 flex justify-center">${medal}</div>
                    <div class="relative">
                        <img src="https://ui-avatars.com/api/?name=${user.email}&background=random&color=fff&size=40" class="w-10 h-10 rounded-full border border-gray-200">
                        <div class="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 border border-gray-100">
                            <i data-lucide="${rank.icon}" class="w-3 h-3" style="color: ${rank.color}"></i>
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            ${safeName}
                            ${user.points >= 600 ? '<i data-lucide="verified" class="w-3 h-3 text-blue-500 fill-blue-500 text-white"></i>' : ''}
                        </p>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${rank.class}">
                            ${rank.title}
                        </span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-black text-gray-800 dark:text-gray-100 text-sm">${user.points || 0}</div>
                    <div class="text-[10px] text-gray-400">ball</div>
                </div>
            </div>
        `;
        list.innerHTML += item;
    });
    lucide.createIcons();
};

initApp();