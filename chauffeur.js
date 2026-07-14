const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";
let supabaseClient;

try {
    if (typeof window !== "undefined" && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (err) { console.error("Erreur d'initialisation Supabase:", err); }

// État local
let driverName = sessionStorage.getItem('driver_name');
let chauffeurOrders = [];

// Vérification de sécurité
if (!driverName) {
    window.location.href = 'login.html';
}

// --- FONCTION PRINCIPALE D'AFFICHAGE ---
const fetchAndDisplayChauffeurOrders = async () => {
    if (!supabaseClient) return;
    
    // On récupère uniquement les courses du chauffeur connecté
    const { data: orders, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('driver_name', driverName)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
    
    if (error) {
        console.error("Erreur lors de la récupération :", error);
        return;
    }

    chauffeurOrders = orders || [];
    const container = document.getElementById('chauffeurOrdersContainer');
    if (!container) return;
    
    if (chauffeurOrders.length === 0) {
        container.innerHTML = `<div class="card" style="text-align:center; padding:20px;">Aucune course assignée pour le moment.</div>`;
        return;
    }
    
    // Génération des cartes
    container.innerHTML = chauffeurOrders.map(o => {
        const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(o.destination)}`;
        const dateISO = o.date ? o.date.replace(/-/g, '') : '';
        const timeISO = o.time ? o.time.replace(/:/g, '') : '0000';
        const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=Course+${encodeURIComponent(o.client_name)}&dates=${dateISO}T${timeISO}00Z/${dateISO}T${timeISO}00Z&details=Client:+${o.client_name}+-+Tel:+${o.client_phone}&location=${encodeURIComponent(o.destination)}`;
        
        const st = (o.status||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const badge = st === 'charge' ? 'badge-charge' : (st === 'depose' || st === 'termine' ? 'badge-depose' : 'badge-attente');
        const statusLabel = st === 'charge' ? 'Pris en charge' : (st === 'depose' || st === 'termine' ? 'Déposé' : 'En attente');

        return `
        <div class="card" style="margin-bottom: 20px; border-left: 5px solid var(--primary);">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <div>
                    <div style="font-size:24px; font-weight:800;">${o.time}</div>
                    <div style="font-size:13px; color:var(--text-muted);">${o.date}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:18px; font-weight:bold; color:var(--primary);">${o.price || 0} €</div>
                    <span class="badge ${badge}">${statusLabel}</span>
                </div>
            </div>
            
            <div style="margin-bottom:10px;">
                <div style="font-weight:700; font-size:16px;">${o.client_name}</div>
                <a href="tel:${o.client_phone}" style="display:block; color:var(--info); font-weight:600; text-decoration:none; margin-top:5px;">
                    <i class="fa-solid fa-phone"></i> ${o.client_phone}
                </a>
            </div>

            <div style="background:#f8fafc; padding:12px; border-radius:6px; margin-bottom:15px; font-size:14px; border: 1px solid var(--border);">
                <div><i class="fa-solid fa-circle-dot" style="color:var(--primary); margin-right:5px;"></i> ${o.departure}</div>
                <div style="margin:5px 0;"><i class="fa-solid fa-arrow-down" style="margin-left:4px; font-size:10px;"></i></div>
                <div><i class="fa-solid fa-location-dot" style="color:var(--danger); margin-right:5px;"></i> ${o.destination}</div>
            </div>

            <div style="display:flex; gap:10px;">
                <a href="${gCalUrl}" target="_blank" class="btn" style="flex:1; text-align:center;">
                    <i class="fa-solid fa-calendar-days"></i> Agenda
                </a>
                <a href="${wazeUrl}" target="_blank" class="btn" style="flex:1; text-align:center;">
                    <i class="fa-brands fa-waze"></i> Waze
                </a>
            </div>
            
            <button class="btn" style="background: var(--success); color: white; border: none; margin-top: 10px;" onclick="updateChauffeurStatus('${o.id}', 'depose')">
                <i class="fa-solid fa-check"></i> Marquer comme Terminé
            </button>
        </div>`;
    }).join('');
};

// --- GESTION ÉTAT ---
async function updateChauffeurStatus(id, newStatus) {
    if(confirm("Confirmer la fin de cette course ?")) {
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', id);
            
        if (!error) {
            fetchAndDisplayChauffeurOrders();
        } else {
            alert("Erreur lors de la mise à jour.");
        }
    }
}

// --- DÉCONNEXION ---
function logout() {
    sessionStorage.removeItem('driver_name');
    window.location.href = 'login.html';
}

// --- INITIALISATION ---
const init = async () => {
    fetchAndDisplayChauffeurOrders();
    
    // Temps réel pour recevoir les nouvelles courses instantanément
    if (supabaseClient) {
        supabaseClient.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchAndDisplayChauffeurOrders();
            })
            .subscribe();
    }
};

init();
