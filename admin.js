const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";
let supabaseClient;
try {
    if (typeof window !== "undefined" && window.supabase) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) { console.error("Erreur d'initialisation Supabase:", err); }

let allVehicles = [];
let allDrivers = [];
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
    if (allDrivers.length === 0) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 40px;">Aucun chauffeur.</td></tr>`; return; }
    
    tbody.innerHTML = allDrivers.map(d => `
        <tr>
            <td><strong>${d.name}</strong></td>
            <td><code style="background:#f1f5f9; padding:4px 8px; border-radius:4px;">${d.password}</code></td>
            <td>
                <div class="action-btn-row">
                    <button class="action-icon action-share" onclick="shareDriverLink('${d.name}', '${d.password}')" title="Copier les accès"><i class="fa-solid fa-link"></i></button>
                    <button class="action-icon action-planning" onclick="openPlanningModal('${d.name}')" title="Voir le planning"><i class="fa-solid fa-calendar-days"></i></button>
                    <button class="action-icon action-edit" onclick="openEditDriverModal('${d.id}', '${d.password}')" title="Modifier le mot de passe"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-icon action-delete" onclick="deleteDriver('${d.id}')" title="Supprimer le chauffeur"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function shareDriverLink(name, password) {
    const appUrl = "https://joshuasebag.github.io/bondecommande1/chauffeur.html"; 
    const message = `🚗 BONJOUR ${name},\n\nVoici tes accès pour l'application VTC :\n\n📍 Lien : ${appUrl}\n👤 Identifiant : ${name}\n🔑 Mot de passe : ${password}\n\nBonne route !`;
    if (navigator.share) { try { await navigator.share({ text: message }); return; } catch(e) {} }
    try { await navigator.clipboard.writeText(message); alert("✅ Accès copiés ! Tu peux maintenant les coller pour les envoyer à " + name + "."); } catch(e) { alert("Erreur lors de la copie."); }
}

const planningModal = document.getElementById('planningModal');
function openPlanningModal(driverName) {
    document.getElementById('planningDriverName').textContent = driverName;
    const tbody = document.getElementById('planningTableBody');
    const driverOrders = globalOrders.filter(o => o.driver_name === driverName);
    if (driverOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">Aucune course assignée.</td></tr>`;
    } else {
        tbody.innerHTML = driverOrders.map(o => {
            let bClass = 'badge-attente'; let sLabel = 'En attente';
            const st = (o.status||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (st === 'charge') { bClass = 'badge-charge'; sLabel = 'Pris en charge'; } else if (st === 'depose' || st === 'termine') { bClass = 'badge-depose'; sLabel = 'Déposé'; }
            const dF = o.date ? new Date(o.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '--/--';
            return `<tr><td><strong>${dF}</strong> à ${o.time}</td><td><div style="font-size:12px; font-weight:500;"><i class="fa-solid fa-circle" style="color:var(--primary); font-size:8px;"></i> ${o.departure}</div><div style="font-size:12px; font-weight:500; margin-top:4px;"><i class="fa-solid fa-location-dot" style="color:var(--danger); font-size:9px;"></i> ${o.destination}</div></td><td><span class="badge ${bClass}">${sLabel}</span></td></tr>`;
        }).join('');
    }
    planningModal.style.display = 'flex';
}
function closePlanningModal() { planningModal.style.display = 'none'; }

const editDriverModal = document.getElementById('editDriverModal');
function openEditDriverModal(id, pass) { document.getElementById('editDriverId').value = id; document.getElementById('editDriverPassword').value = pass; editDriverModal.style.display = 'flex'; }
function closeEditDriverModal() { editDriverModal.style.display = 'none'; }

document.getElementById('editDriverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editDriverId').value;
    const pass = document.getElementById('editDriverPassword').value;
    const { error } = await supabaseClient.from('drivers').update({password: pass}).eq('id', id);
    if (!error) { closeEditDriverModal(); fetchDrivers(); } else { alert("Erreur."); }
});

function populateDriverDropdowns() {
    const opts = '<option value="">- Choisir -</option>' + allDrivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    if(document.getElementById('assignedDriver')) document.getElementById('assignedDriver').innerHTML = opts;
    if(document.getElementById('editAssignedDriver')) document.getElementById('editAssignedDriver').innerHTML = opts;
}
async function deleteDriver(id) { if (confirm("Voulez-vous vraiment supprimer ce chauffeur ?")) { await supabaseClient.from('drivers').delete().eq('id', id); fetchDrivers(); } }

document.getElementById('driverForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newDriver = { name: document.getElementById('driverName').value.trim(), password: document.getElementById('driverPassword').value.trim() };
    const { error } = await supabaseClient.from('drivers').insert([newDriver]);
    if (error) { alert("Erreur."); } else { document.getElementById('driverForm').reset(); fetchDrivers(); }
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
    if (allVehicles.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px;">Aucun véhicule.</td></tr>`; return; }
    tbody.innerHTML = '';
    allVehicles.forEach(v => { tbody.innerHTML += `<tr><td><strong>${v.model}</strong></td><td><code style="background:#f1f5f9; padding:4px 8px; border-radius:4px;">${v.plate}</code></td><td>${v.phone}</td><td><button class="action-icon action-delete" onclick="deleteVehicle('${v.id}')"><i class="fa-solid fa-trash-can"></i></button></td></tr>`; });
}

function populateVehicleDropdowns() {
    const opts = '<option value="">- Sélectionner -</option>' + allVehicles.map(v => `<option value="${v.id}">${v.model} (${v.plate})</option>`).join('');
    if(document.getElementById('assignedVehicle')) document.getElementById('assignedVehicle').innerHTML = opts;
    if(document.getElementById('editAssignedVehicle')) document.getElementById('editAssignedVehicle').innerHTML = opts;
}
async function deleteVehicle(id) { if (confirm("Supprimer ce véhicule ?")) { await supabaseClient.from('vehicles').delete().eq('id', id); fetchVehicles(); } }

document.getElementById('vehicleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newVeh = { model: document.getElementById('vehicleModel').value, plate: document.getElementById('vehiclePlate').value.toUpperCase(), phone: document.getElementById('vehiclePhone').value };
    await supabaseClient.from('vehicles').insert([newVeh]); document.getElementById('vehicleForm').reset(); fetchVehicles();
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

// --- BASE CLIENTS AUTOMATIQUE ---
function renderClientsList() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    const clientsMap = {};
    
    // On extrait tous les clients des commandes
    globalOrders.forEach(o => {
        const phone = (o.client_phone || '').trim();
        const name = (o.client_name || 'Inconnu').trim();
        
        // S'il n'y a ni nom ni téléphone, on ignore
        if (!phone && name === 'Inconnu') return;
        
        // On crée une clé unique (par exemple le numéro de téléphone pour regrouper la même personne)
        const key = phone || name.toLowerCase();

        if (!clientsMap[key]) {
            clientsMap[key] = { name: name, phone: phone, rides: 0, revenue: 0 };
        }

        clientsMap[key].rides += 1;
        
        // On ajoute le CA seulement si la course est terminée
        const st = (o.status || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (st === 'depose' || st === 'termine') {
            clientsMap[key].revenue += (parseFloat(o.price) || 0);
        }
    });

    // On transforme en tableau et on trie du meilleur client au moins bon (par CA)
    const clientsArray = Object.values(clientsMap).sort((a, b) => b.revenue - a.revenue);

    if (clientsArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px;">Aucun client dans l'historique.</td></tr>`;
        return;
    }

    // Affichage dans le tableau
    tbody.innerHTML = clientsArray.map(c => `
        <tr>
            <td><strong><i class="fa-solid fa-user" style="color:var(--text-muted); margin-right:8px;"></i> ${c.name}</strong></td>
            <td>${c.phone ? `<a href="tel:${c.phone}" style="color:var(--info); font-weight:500; text-decoration:none;"><i class="fa-solid fa-phone" style="font-size:12px; margin-right:5px;"></i>${c.phone}</a>` : '<span style="color:#ccc;">Non renseigné</span>'}</td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">${c.rides} course(s)</span></td>
            <td><strong style="color:var(--success);">${c.revenue.toFixed(2)} €</strong></td>
        </tr>
    `).join('');
}

// --- COURSES ---
function generateMissionText(order) {
    const fDate = order.date ? new Date(order.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const creationDate = order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const creationTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '21h00';
    const v = allVehicles.find(v => v.id === order.vehicle_id);
    return `VOTRE MISSION - SERVICE COMMANDÉ : ${order.service_type||'VAN'}\n-------------------------\nDate et heure : ${fDate} à ${order.time||'--:--'}\nDépart : ${order.departure||''}\nDestination : ${order.destination||''}\n\nClient : ${order.client_name||''} - ${order.client_phone||''} (${order.passengers||1} pax)\nChauffeur : ${order.driver_name||''}\n${v?v.phone:''}\n${v?v.model:''}\n${v?v.plate:''}\n\nTarif : ${order.price||'0'}€ ttc PP\nInfos : ${order.info||'Aucune'}\nCommandé le ${creationDate} à ${creationTime}\n-------------------------\nFernand Michel Sebag`;
}

async function shareMissionFromAdmin(orderData) {
    const text = generateMissionText(JSON.parse(decodeURIComponent(orderData)));
    if (navigator.share) { try { await navigator.share({ text: text }); return; } catch(e){} }
    try { await navigator.clipboard.writeText(text); alert("Mission copiée dans le presse-papier !"); } catch(e) { alert("Erreur lors de la copie."); }
}

const fetchAndDisplayOrders = async () => {
    if (!supabaseClient) return;
    const { data: orders, error } = await supabaseClient.from('orders').select('*').order('date', { ascending: true }).order('time', { ascending: true });
    
    if (!error) {
        globalOrders = orders || []; 
        calculateDriverStats();
        renderClientsList(); // Met à jour la liste des clients automatiquement
        
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        if (orders.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px;">Aucune course enregistrée.</td></tr>`; return; }
        
        tbody.innerHTML = '';
        orders.forEach(o => {
            let bClass = 'badge-attente'; let sLabel = 'En attente';
            const st = (o.status||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (st === 'charge') { bClass = 'badge-charge'; sLabel = 'Pris en charge'; } 
            else if (st === 'depose' || st === 'termine') { bClass = 'badge-depose'; sLabel = 'Déposé'; }
            
            const dF = o.date ? new Date(o.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}) : '--/--';
            const v = allVehicles.find(x => x.id === o.vehicle_id);
            const enc = encodeURIComponent(JSON.stringify(o));
            
            tbody.innerHTML += `<tr>
                <td><strong>${dF}</strong> à ${o.time}</td>
                <td><div style="font-size:12px; font-weight:500;"><i class="fa-solid fa-circle" style="color:var(--primary); font-size:8px;"></i> ${o.departure}</div><div style="font-size:12px; font-weight:500; margin-top:4px;"><i class="fa-solid fa-location-dot" style="color:var(--danger); font-size:9px;"></i> ${o.destination}</div><div style="font-size:11px; margin-top:6px; color:var(--text-muted);"><i class="fa-solid fa-user"></i> ${o.client_name} (${o.client_phone})</div></td>
                <td><div style="font-weight:600;"><i class="fa-solid fa-user-tie" style="color:var(--primary);"></i> ${o.driver_name||'Non assigné'}</div><div style="font-size:11px; color:var(--text-muted); margin-top:3px;"><i class="fa-solid fa-car"></i> ${v?v.model:'<span style="color:red">Aucun</span>'}</div></td>
                <td><span class="badge ${bClass}">${sLabel}</span></td>
                <td><div class="action-btn-row"><button class="action-icon action-share" onclick="shareMissionFromAdmin('${enc}')" title="Partager"><i class="fa-solid fa-share-nodes"></i></button><button class="action-icon action-edit" onclick="openEditModal('${enc}')" title="Modifier"><i class="fa-solid fa-pen"></i></button><button class="action-icon action-delete" onclick="deleteOrder('${o.id}')" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button></div></td>
            </tr>`;
        });
    }
};

async function deleteOrder(id) { if (confirm("Supprimer cette course définitivement ?")) { await supabaseClient.from('orders').delete().eq('id', id); fetchAndDisplayOrders(); } }

const editModal = document.getElementById('editModal');
function openEditModal(d) {
    const o = JSON.parse(decodeURIComponent(d));
    document.getElementById('editOrderId').value = o.id; document.getElementById('editServiceType').value = o.service_type||'Transfert'; document.getElementById('editPrice').value = o.price||0; document.getElementById('editDate').value = o.date||''; document.getElementById('editTime').value = o.time||''; document.getElementById('editDeparture').value = o.departure||''; document.getElementById('editDestination').value = o.destination||''; document.getElementById('editAssignedDriver').value = o.driver_name||''; document.getElementById('editAssignedVehicle').value = o.vehicle_id||''; document.getElementById('editStatus').value = o.status||'attente';
    editModal.style.display = 'flex';
}
function closeEditModal() { editModal.style.display = 'none'; }

window.onclick = e => { 
    if (e.target == editModal) closeEditModal(); 
    if (e.target == editDriverModal) closeEditDriverModal(); 
    if (e.target == planningModal) closePlanningModal();
}

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

init();
