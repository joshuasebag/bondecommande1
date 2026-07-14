// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";

let supabaseClient;

try {
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        throw new Error("Supabase non chargée.");
    }
} catch (err) { console.error("Erreur Supabase :", err); }

let allVehicles = [];
let globalOrders = [];

// --- AUTOCOMPLÉTION ---
const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsId);
    if (!input || !suggestionsContainer) return;

    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 3) { suggestionsContainer.style.display = 'none'; return; }
        try {
            const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();
            suggestionsContainer.innerHTML = '';
            if (data.features && data.features.length > 0) {
                suggestionsContainer.style.display = 'block';
                data.features.forEach(feature => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = feature.properties.label;
                    div.addEventListener('click', () => {
                        input.value = feature.properties.label;
                        suggestionsContainer.style.display = 'none';
                    });
                    suggestionsContainer.appendChild(div);
                });
            } else { suggestionsContainer.style.display = 'none'; }
        } catch (error) { console.error(error); }
    });
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== suggestionsContainer) suggestionsContainer.style.display = 'none';
    });
};
setupAutocomplete('departure', 'departure-suggestions');
setupAutocomplete('destination', 'destination-suggestions');
setupAutocomplete('editDeparture', 'editDeparture-suggestions');
setupAutocomplete('editDestination', 'editDestination-suggestions');


// --- VÉHICULES ---
const fetchVehicles = async () => {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('vehicles').select('*').order('model', { ascending: true });
        if (error) throw error;
        allVehicles = data || [];
        renderVehiclesList();
        populateVehicleDropdowns();
    } catch (err) { console.error(err); }
};

function renderVehiclesList() {
    const tbody = document.getElementById('vehiclesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (allVehicles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 15px;">Aucun véhicule.</td></tr>`;
        return;
    }
    allVehicles.forEach(veh => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${veh.model}</strong></td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold;">${veh.plate}</code></td>
            <td>${veh.phone}</td>
            <td><button class="action-icon action-delete" onclick="deleteVehicle('${veh.id}')"><i class="fa-solid fa-trash-can"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function populateVehicleDropdowns() {
    const createSelect = document.getElementById('assignedVehicle');
    const editSelect = document.getElementById('editAssignedVehicle');
    const generateOptionsHTML = () => {
        let html = '<option value="">-- Sélectionner un véhicule --</option>';
        allVehicles.forEach(veh => { html += `<option value="${veh.id}">${veh.model} (${veh.plate})</option>`; });
        return html;
    };
    if (createSelect) createSelect.innerHTML = generateOptionsHTML();
    if (editSelect) editSelect.innerHTML = generateOptionsHTML();
}

async function deleteVehicle(vehId) {
    if (!supabaseClient || !confirm("Supprimer ce véhicule ?")) return;
    try {
        const { error } = await supabaseClient.from('vehicles').delete().eq('id', vehId);
        if (error) throw error;
        fetchVehicles();
    } catch (err) { alert(err.message); }
}

const vehicleForm = document.getElementById('vehicleForm');
if (vehicleForm) {
    vehicleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newVeh = {
            model: document.getElementById('vehicleModel').value,
            plate: document.getElementById('vehiclePlate').value.toUpperCase(),
            phone: document.getElementById('vehiclePhone').value
        };
        try {
            const { error } = await supabaseClient.from('vehicles').insert([newVeh]);
            if (error) throw error;
            vehicleForm.reset();
            fetchVehicles();
        } catch (err) { alert(err.message); }
    });
}


// --- CALCUL DU CA ---
function calculateDriverStats() {
    const statsContainer = document.getElementById('driverStatsContainer');
    if (!statsContainer) return;
    const currentDate = new Date();
    const currentYearMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const driverEarningsMonth = { "Michel": 0, "Chauffeur 2": 0 };
    const driverEarningsTotal = { "Michel": 0, "Chauffeur 2": 0 };

    globalOrders.forEach(order => {
        if (!order.status || !order.date) return;
        const cleanStatus = order.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (cleanStatus === "depose" || cleanStatus === "termine") {
            const driver = order.driver_name || "Non assigné";
            const price = parseFloat(order.price) || 0;
            if (driverEarningsTotal[driver] === undefined) driverEarningsTotal[driver] = 0;
            driverEarningsTotal[driver] += price;
            
            const orderYearMonth = order.date.substring(0, 7).trim(); 
            if (orderYearMonth === currentYearMonthStr) {
                if (driverEarningsMonth[driver] === undefined) driverEarningsMonth[driver] = 0;
                driverEarningsMonth[driver] += price;
            }
        }
    });

    statsContainer.innerHTML = '';
    const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const allDrivers = new Set([...Object.keys(driverEarningsMonth), ...Object.keys(driverEarningsTotal)]);

    allDrivers.forEach(driver => {
        const monthCA = driverEarningsMonth[driver] || 0;
        const totalCA = driverEarningsTotal[driver] || 0;
        const statBox = document.createElement('div');
        statBox.className = 'stat-box';
        statBox.innerHTML = `
            <div style="font-size: 12px; font-weight: 700; color: var(--text-main); text-transform: uppercase; border-bottom: 1px dashed var(--border); padding-bottom: 8px; margin-bottom: 8px;">
                <i class="fa-solid fa-user-tie" style="color: var(--primary);"></i> ${driver}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; color: var(--text-muted);">Mois (${capitalizedMonth})</span>
                <span style="font-weight: 800; font-size: 14px; color: ${monthCA > 0 ? 'var(--success)' : 'var(--text-main)'};">${monthCA.toFixed(2)} €</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: var(--text-muted);">Total Annuel</span>
                <span style="font-weight: 800; font-size: 14px; color: var(--primary);">${totalCA.toFixed(2)} €</span>
            </div>
        `;
        statsContainer.appendChild(statBox);
    });
}


// --- PARTAGE MISSION ---
function generateMissionText(order) {
    const formattedDate = order.date ? new Date(order.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date inconnue';
    const creationDate = order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const creationTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '21h00';
    const veh = allVehicles.find(v => v.id === order.vehicle_id);

    return `VOTRE MISSION - SERVICE COMMANDÉ : ${order.service_type ? order.service_type.toUpperCase() : 'VAN'}
-------------------------
Date et heure : ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)} à ${order.time || '--:--'}
Départ : ${order.departure || 'Non spécifié'}
Destination : ${order.destination || 'Non spécifiée'}

client : ${order.client_name || 'Non spécifié'}
Tel : ${order.client_phone || ''}  (${order.passengers || 1} pax)

Chauffeur : ${order.driver_name || 'Non assigné'}
${veh ? veh.phone : '+33661376190'}
${veh ? veh.model : 'Mercedes Class V'}
${veh ? veh.plate : 'Non spécifiée'}

Tarif sous-traitant : ${order.price || '0'}€ ttc PP
Infos : ${order.info || 'Aucune'}
Commandé le ${creationDate} à ${creationTime}

Nous vous remercions pour votre confiance.
-------------------------
Fernand Michel Sebag
En cas de besoin : +33661376190
Siret 90776001100029`;
}

async function shareMissionFromAdmin(orderData) {
    const text = generateMissionText(JSON.parse(decodeURIComponent(orderData)));
    if (navigator.share) { try { await navigator.share({ text: text }); return; } catch (err) {} }
    try { await navigator.clipboard.writeText(text); alert("Copié !"); } catch (err) { alert("Échec copie."); }
}


// --- GESTION DES COURSES (TABLEAU) ---
const fetchAndDisplayOrders = async () => {
    if (!supabaseClient) return;
    try {
        const { data: orders, error } = await supabaseClient.from('orders').select('*').order('date', { ascending: true }).order('time', { ascending: true });
        if (error) throw error;
        globalOrders = orders || [];
        calculateDriverStats();

        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Aucune course.</td></tr>`;
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-attente'; let statusLabel = 'En attente';
            
            if (order.status) {
                const checkStat = order.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (checkStat === 'charge') { badgeClass = 'badge-charge'; statusLabel = 'Pris en charge'; } 
                else if (checkStat === 'depose' || checkStat === 'termine') { badgeClass = 'badge-depose'; statusLabel = 'Déposé'; }
            }

            const safeOrderData = encodeURIComponent(JSON.stringify(order));
            const dateF = order.date ? new Date(order.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}) : '--/--';
            const veh = allVehicles.find(v => v.id === order.vehicle_id);

            tr.innerHTML = `
                <td><strong>${dateF}</strong> à ${order.time}</td>
                <td>
                    <div style="font-size:12px; font-weight: 500;"><i class="fa-solid fa-circle" style="color:var(--primary); font-size:8px;"></i> ${order.departure}</div>
                    <div style="font-size:12px; font-weight: 500; margin-top:4px;"><i class="fa-solid fa-location-dot" style="color:var(--danger); font-size:9px;"></i> ${order.destination}</div>
                    <div style="font-size:11px; margin-top:6px; color:var(--text-muted);"><i class="fa-solid fa-user"></i> ${order.client_name} (${order.client_phone})</div>
                </td>
                <td>
                    <div style="font-weight: 600;"><i class="fa-solid fa-user-tie" style="color: var(--primary);"></i> ${order.driver_name || 'Non assigné'}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top:3px;"><i class="fa-solid fa-car"></i> ${veh ? veh.model : '<span style="color:red">Aucun</span>'}</div>
                </td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td>
                    <div class="action-btn-row">
                        <button class="action-icon action-share" onclick="shareMissionFromAdmin('${safeOrderData}')"><i class="fa-solid fa-share-nodes"></i></button>
                        <button class="action-icon action-edit" onclick="openEditModal('${safeOrderData}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-icon action-delete" onclick="deleteOrder('${order.id}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
};

async function deleteOrder(orderId) {
    if (!supabaseClient || !confirm("Supprimer cette course ?")) return;
    try { await supabaseClient.from('orders').delete().eq('id', orderId); fetchAndDisplayOrders(); } catch (err) { alert(err.message); }
}


// --- MODAL EDITION ---
const editModal = document.getElementById('editModal');
function openEditModal(orderData) {
    const order = JSON.parse(decodeURIComponent(orderData));
    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editServiceType').value = order.service_type || 'Transfert';
    document.getElementById('editPrice').value = order.price || 0;
    document.getElementById('editDate').value = order.date || '';
    document.getElementById('editTime').value = order.time || '';
    document.getElementById('editDeparture').value = order.departure || '';
    document.getElementById('editDestination').value = order.destination || '';
    document.getElementById('editAssignedDriver').value = order.driver_name || 'Michel';
    document.getElementById('editAssignedVehicle').value = order.vehicle_id || '';
    document.getElementById('editStatus').value = order.status || 'attente';
    editModal.style.display = 'flex';
}
function closeEditModal() { editModal.style.display = 'none'; }
window.onclick = function(e) { if (e.target == editModal) closeEditModal(); }

document.getElementById('editOrderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;
    const orderId = document.getElementById('editOrderId').value;
    const updatedOrder = {
        service_type: document.getElementById('editServiceType').value,
        price: parseFloat(document.getElementById('editPrice').value),
        date: document.getElementById('editDate').value,
        time: document.getElementById('editTime').value,
        departure: document.getElementById('editDeparture').value,
        destination: document.getElementById('editDestination').value,
        driver_name: document.getElementById('editAssignedDriver').value,
        vehicle_id: document.getElementById('editAssignedVehicle').value || null,
        status: document.getElementById('editStatus').value
    };
    try { await supabaseClient.from('orders').update(updatedOrder).eq('id', orderId); closeEditModal(); fetchAndDisplayOrders(); } catch (err) { alert(err.message); }
});


// --- CREATION ---
document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;
    const newOrder = {
        service_type: document.getElementById('serviceType').value,
        price: parseFloat(document.getElementById('price').value),
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        departure: document.getElementById('departure').value,
        destination: document.getElementById('destination').value,
        client_name: document.getElementById('clientName').value,
        client_phone: document.getElementById('clientPhone').value,
        passengers: parseInt(document.getElementById('passengers').value),
        driver_name: document.getElementById('assignedDriver').value,
        vehicle_id: document.getElementById('assignedVehicle').value || null,
        info: document.getElementById('info').value,
        status: 'attente'
    };
    try { await supabaseClient.from('orders').insert([newOrder]); document.getElementById('orderForm').reset(); fetchAndDisplayOrders(); alert("Envoyé !"); } catch (err) { alert(err.message); }
});

// --- INIT ---
const init = async () => {
    await fetchVehicles(); 
    await fetchAndDisplayOrders(); 
    if (supabaseClient) {
        supabaseClient.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAndDisplayOrders())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => { fetchVehicles().then(() => fetchAndDisplayOrders()); }).subscribe();
    }
};
init();
