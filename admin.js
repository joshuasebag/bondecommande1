const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";
let supabaseClient;
try {
    if (typeof window !== "undefined" && window.supabase) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) { console.error("Erreur d'initialisation Supabase:", err); }

let allVehicles = [];
let allDrivers = [];
let globalOrders = [];

// --- AUTOCOMPLÉTION ADRESSES ---
const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId); 
    const suggestionsContainer = document.getElementById(suggestionsId);
    if (!input || !suggestionsContainer) return;
    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 3) { suggestionsContainer.style.display = 'none'; return; }
        try {
            const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
            const data = await res.json();
            suggestionsContainer.innerHTML = '';
            if (data.features && data.features.length > 0) {
                suggestionsContainer.style.display = 'block';
                data.features.forEach(f => {
                    const div = document.createElement('div'); div.className = 'suggestion-item'; div.textContent = f.properties.label;
                    div.addEventListener('click', () => { input.value = f.properties.label; suggestionsContainer.style.display = 'none'; });
                    suggestionsContainer.appendChild(div);
                });
            } else { suggestionsContainer.style.display = 'none'; }
        } catch (err) {}
    });
    document.addEventListener('click', (e) => { if (e.target !== input && e.target !== suggestionsContainer) suggestionsContainer.style.display = 'none'; });
};

setupAutocomplete('departure', 'departure-suggestions'); setupAutocomplete('destination', 'destination-suggestions');
setupAutocomplete('editDeparture', 'editDeparture-suggestions'); setupAutocomplete('editDestination', 'editDestination-suggestions');

// --- AUTOCOMPLÉTION CLIENTS ---
const setupClientAutocomplete = () => {
    const input = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const suggestionsContainer = document.getElementById('clientName-suggestions');
    if (!input || !suggestionsContainer) return;
    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) { suggestionsContainer.style.display = 'none'; return; }
        const clientsMap = {};
        globalOrders.forEach(o => {
            const name = (o.client_name || '').trim();
            if (name !== '' && o.client_phone) clientsMap[name] = o.client_phone.trim();
        });
        const matches = Object.keys(clientsMap).filter(name => name.toLowerCase().includes(query));
        suggestionsContainer.innerHTML = '';
        if (matches.length > 0) {
            suggestionsContainer.style.display = 'block';
            matches.forEach(name => {
                const div = document.createElement('div'); div.className = 'suggestion-item'; 
                div.innerHTML = `<strong>${name}</strong> <span style="color:var(--text-muted); font-size:12px; margin-left:8px;">${clientsMap[name]}</span>`;
                div.addEventListener('click', () => { input.value = name; phoneInput.value = clientsMap[name]; suggestionsContainer.style.display = 'none'; });
                suggestionsContainer.appendChild(div);
            });
        } else { suggestionsContainer.style.display = 'none'; }
    });
};
setupClientAutocomplete();

// --- CHAUFFEURS ---
const fetchDrivers = async () => {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('drivers').select('*').order('name', { ascending: true });
    if (!error) { allDrivers = data || []; renderDriversList(); populateDriverDropdowns(); calculateDriverStats(); }
};

function renderDriversList() {
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;
    if (allDrivers.length === 0) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 40px;">Aucun chauffeur.</td></tr>`; return; }
    tbody.innerHTML = allDrivers.map(d => `
        <tr><td><strong>${d.name}</strong></td><td><code style="background:#f1f5f9; padding:4px 8px; border-radius:4px;">${d.password}</code></td>
        <td><div class="action-btn-row">
            <button class="action-icon action-share" onclick="shareDriverLink('${d.name}', '${d.password}')" title="Copier les accès"><i class="fa-solid fa-link"></i></button>
            <button class="action-icon action-planning" onclick="openPlanningModal('${d.name}')" title="Voir le planning"><i class="fa-solid fa-calendar-days"></i></button>
            <button class="action-icon action-edit" onclick="openEditDriverModal('${d.id}', '${d.password}')" title="Modifier"><i class="fa-solid fa-pen"></i></button>
            <button class="action-icon action-delete" onclick="deleteDriver('${d.id}')" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
        </div></td></tr>`).join('');
}

async function shareDriverLink(name, password) {
    const appUrl = "https://joshuasebag.github.io/bondecommande1/chauffeur.html"; 
    const message = `🚗 BONJOUR ${name},\n\nVoici tes accès :\n\n📍 Lien : ${appUrl}\n👤 Identifiant : ${name}\n🔑 Mot de passe : ${password}`;
    if (navigator.share) { try { await navigator.share({ text: message }); return; } catch(e) {} }
    try { await navigator.clipboard.writeText(message); alert("Accès copiés !"); } catch(e) { alert("Erreur."); }
}

const planningModal = document.getElementById('planningModal');
function openPlanningModal(driverName) {
    document.getElementById('planningDriverName').textContent = driverName;
    const tbody = document.getElementById('planningTableBody');
    const driverOrders = globalOrders.filter(o => o.driver_name === driverName);
    if (driverOrders.length === 0) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">Aucune course.</td></tr>`; }
    else { tbody.innerHTML = driverOrders.map(o => `<tr><td><strong>${o.date}</strong> à ${o.time}</td><td>${o.departure} → ${o.destination}</td><td>${o.status}</td></tr>`).join(''); }
    planningModal.style.display = 'flex';
}
function closePlanningModal() { planningModal.style.display = 'none'; }

const editDriverModal = document.getElementById('editDriverModal');
function openEditDriverModal(id, pass) { document.getElementById('editDriverId').value = id; document.getElementById('editDriverPassword').value = pass; editDriverModal.style.display = 'flex'; }
function closeEditDriverModal() { editDriverModal.style.display = 'none'; }

document.getElementById('editDriverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.from('drivers').update({password: document.getElementById('editDriverPassword').value}).eq('id', document.getElementById('editDriverId').value);
    if (!error) { closeEditDriverModal(); fetchDrivers(); }
});

function populateDriverDropdowns() {
    const opts = '<option value="">- Choisir -</option>' + allDrivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    if(document.getElementById('assignedDriver')) document.getElementById('assignedDriver').innerHTML = opts;
    if(document.getElementById('editAssignedDriver')) document.getElementById('editAssignedDriver').innerHTML = opts;
}
async function deleteDriver(id) { if (confirm("Supprimer ce chauffeur ?")) { await supabaseClient.from('drivers').delete().eq('id', id); fetchDrivers(); } }

document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDriver = { name: document.getElementById('driverName').value.trim(), password: document.getElementById('driverPassword').value.trim() };
    await supabaseClient.from('drivers').insert([newDriver]); document.getElementById('driverForm').reset(); fetchDrivers();
});

// --- VÉHICULES ---
const fetchVehicles = async () => {
    const { data } = await supabaseClient.from('vehicles').select('*');
    allVehicles = data || []; renderVehiclesList(); populateVehicleDropdowns();
};
function renderVehiclesList() {
    const tbody = document.getElementById('vehiclesTableBody');
    if (!tbody) return;
    tbody.innerHTML = allVehicles.map(v => `<tr><td><strong>${v.model}</strong></td><td><code>${v.plate}</code></td><td>${v.phone}</td><td><button onclick="deleteVehicle('${v.id}')"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('');
}
function populateVehicleDropdowns() {
    const opts = '<option value="">- Sélectionner -</option>' + allVehicles.map(v => `<option value="${v.id}">${v.model} (${v.plate})</option>`).join('');
    if(document.getElementById('assignedVehicle')) document.getElementById('assignedVehicle').innerHTML = opts;
    if(document.getElementById('editAssignedVehicle')) document.getElementById('editAssignedVehicle').innerHTML = opts;
}
async function deleteVehicle(id) { if (confirm("Supprimer ?")) { await supabaseClient.from('vehicles').delete().eq('id', id); fetchVehicles(); } }
document.getElementById('vehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await supabaseClient.from('vehicles').insert([{ model: document.getElementById('vehicleModel').value, plate: document.getElementById('vehiclePlate').value.toUpperCase(), phone: document.getElementById('vehiclePhone').value }]);
    document.getElementById('vehicleForm').reset(); fetchVehicles();
});

// --- CA ET STATS ---
function calculateDriverStats() {
    const container = document.getElementById('driverStatsContainer');
    if (!container) return;
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const driverEarningsMonth = {}; const driverEarningsTotal = {};
    allDrivers.forEach(d => { driverEarningsMonth[d.name] = 0; driverEarningsTotal[d.name] = 0; });
    globalOrders.forEach(order => {
        const st = (order.status||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (st === "depose" || st === "termine") {
            const drv = order.driver_name;
            const price = parseFloat(order.price) || 0;
            if(driverEarningsTotal[drv] !== undefined) driverEarningsTotal[drv] += price;
            if(order.date && order.date.substring(0, 7) === currentMonthStr && driverEarningsMonth[drv] !== undefined) { driverEarningsMonth[drv] += price; }
        }
    });
    container.innerHTML = allDrivers.map(d => `
        <div class="stat-box">
            <div style="font-weight:700;">${d.name}</div>
            <div>Mois: ${driverEarningsMonth[d.name].toFixed(2)}€</div>
            <div>Total: ${driverEarningsTotal[d.name].toFixed(2)}€</div>
        </div>`).join('');
}

// --- BASE CLIENTS (La modif demandée) ---
function renderClientsList() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    const clientsMap = {};
    globalOrders.forEach(o => {
        const phone = (o.client_phone || '').trim();
        const name = (o.client_name || 'Inconnu').trim();
        if (!phone && name === 'Inconnu') return;
        // Clé basée sur le nom complet + téléphone pour différencier les homonymes
        const key = (name + "_" + phone).toLowerCase();
        if (!clientsMap[key]) clientsMap[key] = { name: name, phone: phone, rides: 0, revenue: 0 };
        clientsMap[key].rides += 1;
        if (o.status === 'depose' || o.status === 'termine') clientsMap[key].revenue += (parseFloat(o.price) || 0);
    });
    const clientsArray = Object.values(clientsMap).sort((a, b) => b.revenue - a.revenue);
    tbody.innerHTML = clientsArray.map(c => `<tr><td><strong>${c.name}</strong></td><td>${c.phone}</td><td>${c.rides}</td><td>${c.revenue.toFixed(2)}€</td></tr>`).join('');
}

// --- COURSES ---
const fetchAndDisplayOrders = async () => {
    const { data: orders } = await supabaseClient.from('orders').select('*').order('date', { ascending: true });
    globalOrders = orders || [];
    calculateDriverStats();
    renderClientsList();
    const tbody = document.getElementById('ordersTableBody');
    if (tbody) tbody.innerHTML = orders.map(o => `<tr><td>${o.date}</td><td>${o.client_name}</td><td>${o.driver_name}</td><td>${o.status}</td><td><button onclick="deleteOrder('${o.id}')">Suppr</button></td></tr>`).join('');
};
async function deleteOrder(id) { if (confirm("Supprimer ?")) { await supabaseClient.from('orders').delete().eq('id', id); fetchAndDisplayOrders(); } }

// --- INIT ---
const init = async () => { await fetchDrivers(); await fetchVehicles(); await fetchAndDisplayOrders(); };
init();
supabaseClient.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public' }, fetchAll).subscribe();
