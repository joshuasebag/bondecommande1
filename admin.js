const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allVehicles = [], allDrivers = [], globalOrders = [];

async function fetchData() {
    const { data: v } = await supabase.from('vehicles').select('*');
    const { data: d } = await supabase.from('drivers').select('*');
    const { data: o } = await supabase.from('orders').select('*').order('date', {ascending:false});
    allVehicles = v || []; allDrivers = d || []; globalOrders = o || [];
    renderAll();
}

function renderAll() {
    // Rendus tables
    const dBody = document.getElementById('driversTableBody');
    dBody.innerHTML = allDrivers.map(d => `<tr><td>${d.name}</td><td>${d.password}</td><td><button class="action-icon" onclick="openEditDriverModal('${d.id}','${d.password}')"><i class="fa-solid fa-pen"></i></button></td></tr>`).join('');
    
    const vBody = document.getElementById('vehiclesTableBody');
    vBody.innerHTML = allVehicles.map(v => `<tr><td>${v.model}</td><td>${v.plate}</td><td><button class="action-icon" onclick="deleteVehicle('${v.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    const oBody = document.getElementById('ordersTableBody');
    oBody.innerHTML = globalOrders.map(o => `<tr><td>${o.date}</td><td>${o.departure} > ${o.destination}</td><td>${o.driver_name}</td><td>${o.status}</td><td><button class="action-icon" onclick="deleteOrder('${o.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');

    // Update Dropdowns
    const dOpts = allDrivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    document.getElementById('assignedDriver').innerHTML = dOpts;
    document.getElementById('editAssignedDriver').innerHTML = dOpts;
    
    // CA
    const stats = document.getElementById('driverStatsContainer');
    stats.innerHTML = allDrivers.map(d => {
        const total = globalOrders.filter(o => o.driver_name === d.name && o.status === 'depose').reduce((sum, o) => sum + (parseFloat(o.price)||0), 0);
        return `<div class="stat-box"><strong>${d.name}</strong><br>${total.toFixed(2)} €</div>`;
    }).join('');
}

document.getElementById('driverForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('drivers').insert({name: document.getElementById('driverName').value, password: document.getElementById('driverPassword').value});
    fetchData();
};

document.getElementById('vehicleForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('vehicles').insert({model: document.getElementById('vehicleModel').value, plate: document.getElementById('vehiclePlate').value, phone: document.getElementById('vehiclePhone').value});
    fetchData();
};

document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('orders').insert({
        service_type: document.getElementById('serviceType').value,
        price: document.getElementById('price').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        departure: document.getElementById('departure').value,
        destination: document.getElementById('destination').value,
        driver_name: document.getElementById('assignedDriver').value,
        vehicle_id: document.getElementById('assignedVehicle').value,
        client_name: document.getElementById('clientName').value,
        client_phone: document.getElementById('clientPhone').value,
        status: 'attente'
    });
    fetchData();
};

function openEditDriverModal(id, pass) {
    document.getElementById('editDriverId').value = id;
    document.getElementById('editDriverPassword').value = pass;
    document.getElementById('editDriverModal').style.display = 'flex';
}
document.getElementById('editDriverForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('drivers').update({password: document.getElementById('editDriverPassword').value}).eq('id', document.getElementById('editDriverId').value);
    document.getElementById('editDriverModal').style.display = 'none';
    fetchData();
};

fetchData();
