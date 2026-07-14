const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";
let supabaseClient;
try {
    if (typeof window !== "undefined" && window.supabase) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) { console.error(err); }

let allVehicles = [];
let allDrivers = [];
let globalOrders = [];

// --- AUTOCOMPLÉTION ---
const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId); const suggestionsContainer = document.getElementById(suggestionsId);
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
            } else suggestionsContainer.style.display = 'none';
        } catch (err) {}
    });
    document.addEventListener('click', (e) => { if (e.target !== input && e.target !== suggestionsContainer) suggestionsContainer.style.display = 'none'; });
};
setupAutocomplete('departure', 'departure-suggestions'); setupAutocomplete('destination', 'destination-suggestions');
setupAutocomplete('editDeparture', 'editDeparture-suggestions'); setupAutocomplete('editDestination', 'editDestination-suggestions');

// --- CHAUFFEURS ---
const fetchDrivers = async () => {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('drivers').select('*').order('name', { ascending: true });
    if (!error) {
        allDrivers = data || [];
        renderDriversList();
        populateDriverDropdowns();
        calculateDriverStats();
    }
};

function renderDriversList() {
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;
    tbody.innerHTML = allDrivers.length === 0 ? `<tr><td colspan="3" style="text-align:center;">Aucun chauffeur.</td></tr>` : '';
    allDrivers.forEach(d => {
        tbody.innerHTML += `<tr>
            <td><strong>${d.name}</strong></td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${d.password}</code></td>
            <td><button class="action-icon action-delete" onclick="deleteDriver('${d.id}')"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`;
    });
}

function populateDriverDropdowns() {
    const opts = '<option value="">- Choisir -</option>' + allDrivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    if(document.getElementById('assignedDriver')) document.getElementById('assignedDriver').innerHTML = opts;
    if(document.getElementById('editAssignedDriver')) document.getElementById('editAssignedDriver').innerHTML = opts;
}

async function deleteDriver(id) {
    if (confirm("Supprimer ce chauffeur ?")) {
        await supabaseClient.from('drivers').delete().eq('id', id);
        fetchDrivers();
    }
}

document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDriver = { name: document.getElementById('driverName').value.trim(), password: document.getElementById('driverPassword').value.trim() };
    const { error } = await supabaseClient.from('drivers').insert([newDriver]);
    if (error) alert("Erreur (Ce nom existe peut-être déjà).");
    else { document.getElementById('driverForm').reset(); fetchDrivers(); }
});

// --- VÉHICULES ---
const fetchVehicles = async () => {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('vehicles').select('*').order('model', { ascending: true });
    if (!error) { allVehicles = data || []; renderVehiclesList(); populateVehicleDropdowns(); }
};

function renderVehiclesList() {
    const tbody = document.getElementById('vehiclesTableBody');
    if (!tbody) return;
    tbody.innerHTML = allVehicles.length === 0 ? `<tr><td colspan="4" style="text-align:center;">Aucun véhicule.</td></tr>` : '';
    allVehicles.forEach(v => {
        tbody.innerHTML += `<tr>
            <td><strong>${v.model}</strong></td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${v.plate}</code></td>
            <td>${v.phone}</td>
            <td><button class="action-icon action-delete" onclick="deleteVehicle('${v.id}')"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`;
    });
}

function populateVehicleDropdowns() {
    const opts = '<option value="">- Sélectionner -</option>' + allVehicles.map(v => `<option value="${v.id}">${v.model} (${v.plate})</option>`).join('');
    if(document.getElementById('assignedVehicle')) document.getElementById('assignedVehicle').innerHTML = opts;
    if(document.getElementById('editAssignedVehicle')) document.getElementById('editAssignedVehicle').innerHTML = opts;
}

async function deleteVehicle(id) {
    if (confirm("Supprimer ce véhicule ?")) { await supabaseClient.from('vehicles').delete().eq('id', id); fetchVehicles(); }
}

document.getElementById('vehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newVeh = { model: document.getElementById('vehicleModel').value, plate: document.getElementById('vehiclePlate').value.toUpperCase(), phone: document.getElementById('vehiclePhone').value };
    await supabaseClient.from('vehicles').insert([newVeh]);
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
            if(order.date && order.date.substring(0, 7) === currentMonthStr && driverEarningsMonth[drv] !== undefined) driverEarningsMonth[drv] += price;
        }
    });

    container.innerHTML = '';
    const mName = now.toLocaleDateString('fr-FR', { month: 'long' });
    allDrivers.forEach(d => {
        const drv = d.name;
        container.innerHTML += `<div class="stat-box">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-main); text-transform: uppercase; border-bottom: 1px dashed var(--border); padding-bottom: 8px; margin-bottom: 8px;"><i class="fa-solid fa-user-tie" style="color: var(--primary);"></i> ${drv}</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;"><span style="font-size: 11px; color: var(--text-muted);">Mois (${mName})</span><span style="font-weight: 800; font-size: 14px; color: ${driverEarningsMonth[drv]>0?'var(--success)':'var(--text-main)'};">${driverEarningsMonth[drv].toFixed(2)} €</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-size: 11px; color: var(--text-muted);">Total Annuel</span><span style="font-weight: 800; font-size: 14px; color: var(--primary);">${driverEarningsTotal[drv].toFixed(2)} €</span></div>
        </div>`;
    });
}

// --- COURSES ---
function generateMissionText(order) {
    const fDate = order.date ? new Date(order.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const v = allVehicles.find(v => v.id === order.vehicle_id);
    return `VOTRE MISSION - SERVICE COMMANDÉ : ${order.service_type||'VAN'}\n-------------------------\nDate et heure : ${fDate} à ${order.time||'--:--'}\nDépart : ${order.departure||''}\nDestination : ${order.destination||''}\n\nClient : ${order.client_name||''} - ${order.client_phone||''} (${order.passengers||1} pax)\nChauffeur : ${order.driver_name||''}\n${v?v.phone:''}\n${v?v.model:''}\n${v?v.plate:''}\n\nTarif : ${order.price||'0'}€ ttc PP\nInfos : ${order.info||'Aucune'}\n-------------------------\nFernand Michel Sebag`;
}

async function shareMissionFromAdmin(orderData) {
    const text = generateMissionText(JSON.parse(decodeURIComponent(orderData)));
    if (navigator.share) { try { await navigator.share({ text: text }); return; } catch(e){} }
    try { await navigator.clipboard.writeText(text); alert("Copié !"); } catch(e) {}
}

const fetchAndDisplayOrders = async () => {
    if (!supabaseClient) return;
    const { data: orders, error } = await supabaseClient.from('orders').select('*').order('date', { ascending: true }).order('time', { ascending: true });
    if (!error) {
        globalOrders = orders || []; calculateDriverStats();
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        tbody.innerHTML = orders.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:40px;">Aucune course.</td></tr>` : '';
        orders.forEach(o => {
            let bClass = 'badge-attente'; let sLabel = 'En attente';
            const st = (o.status||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (st === 'charge') { bClass = 'badge-charge'; sLabel = 'Pris en charge'; } else if (st === 'depose' || st === 'termine') { bClass = 'badge-depose'; sLabel = 'Déposé'; }
            const dF = o.date ? new Date(o.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}) : '--/--';
            const v = allVehicles.find(x => x.id === o.vehicle_id);
            const enc = encodeURIComponent(JSON.stringify(o));
            tbody.innerHTML += `<tr>
                <td><strong>${dF}</strong> à ${o.time}</td>
                <td><div style="font-size:12px; font-weight:500;"><i class="fa-solid fa-circle" style="color:var(--primary); font-size:8px;"></i> ${o.departure}</div><div style="font-size:12px; font-weight:500; margin-top:4px;"><i class="fa-solid fa-location-dot" style="color:var(--danger); font-size:9px;"></i> ${o.destination}</div><div style="font-size:11px; margin-top:6px; color:var(--text-muted);"><i class="fa-solid fa-user"></i> ${o.client_name} (${o.client_phone})</div></td>
                <td><div style="font-weight:600;"><i class="fa-solid fa-user-tie" style="color:var(--primary);"></i> ${o.driver_name||'Non assigné'}</div><div style="font-size:11px; color:var(--text-muted); margin-top:3px;"><i class="fa-solid fa-car"></i> ${v?v.model:'<span style="color:red">Aucun</span>'}</div></td>
                <td><span class="badge ${bClass}">${sLabel}</span></td>
                <td><div class="action-btn-row"><button class="action-icon action-share" onclick="shareMissionFromAdmin('${enc}')"><i class="fa-solid fa-share-nodes"></i></button><button class="action-icon action-edit" onclick="openEditModal('${enc}')"><i class="fa-solid fa-pen"></i></button><button class="action-icon action-delete" onclick="deleteOrder('${o.id}')"><i class="fa-solid fa-trash-can"></i></button></div></td>
            </tr>`;
        });
    }
};

async function deleteOrder(id) { if (confirm("Supprimer ?")) { await supabaseClient.from('orders').delete().eq('id', id); fetchAndDisplayOrders(); } }

const editModal = document.getElementById('editModal');
function openEditModal(d) {
    const o = JSON.parse(decodeURIComponent(d));
    document.getElementById('editOrderId').value = o.id; document.getElementById('editServiceType').value = o.service_type||'Transfert'; document.getElementById('editPrice').value = o.price||0; document.getElementById('editDate').value = o.date||''; document.getElementById('editTime').value = o.time||''; document.getElementById('editDeparture').value = o.departure||''; document.getElementById('editDestination').value = o.destination||''; document.getElementById('editAssignedDriver').value = o.driver_name||''; document.getElementById('editAssignedVehicle').value = o.vehicle_id||''; document.getElementById('editStatus').value = o.status||'attente';
    editModal.style.display = 'flex';
}
function closeEditModal() { editModal.style.display = 'none'; }
window.onclick = e => { if (e.target == editModal) closeEditModal(); }

document.getElementById('editOrderForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const updated = { service_type: document.getElementById('editServiceType').value, price: parseFloat(document.getElementById('editPrice').value), date: document.getElementById('editDate').value, time: document.getElementById('editTime').value, departure: document.getElementById('editDeparture').value, destination: document.getElementById('editDestination').value, driver_name: document.getElementById('editAssignedDriver').value, vehicle_id: document.getElementById('editAssignedVehicle').value||null, status: document.getElementById('editStatus').value };
    await supabaseClient.from('orders').update(updated).eq('id', document.getElementById('editOrderId').value);
    closeEditModal(); fetchAndDisplayOrders();
});

document.getElementById('orderForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const newO = { service_type: document.getElementById('serviceType').value, price: parseFloat(document.getElementById('price').value), date: document.getElementById('date').value, time: document.getElementById('time').value, departure: document.getElementById('departure').value, destination: document.getElementById('destination').value, client_name: document.getElementById('clientName').value, client_phone: document.getElementById('clientPhone').value, passengers: parseInt(document.getElementById('passengers').value), driver_name: document.getElementById('assignedDriver').value, vehicle_id: document.getElementById('assignedVehicle').value||null, info: document.getElementById('info').value, status: 'attente' };
    await supabaseClient.from('orders').insert([newO]); document.getElementById('orderForm').reset(); fetchAndDisplayOrders();
});

const init = async () => {
    await fetchDrivers(); await fetchVehicles(); await fetchAndDisplayOrders();
    if (supabaseClient) {
        supabaseClient.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAndDisplayOrders())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => { fetchVehicles().then(fetchAndDisplayOrders); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => { fetchDrivers().then(fetchAndDisplayOrders); })
            .subscribe();
    }
};
init();v
