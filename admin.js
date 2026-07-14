const supabase = supabase.createClient("https://vvdfxcnxzwcidxtzqfgx.supabase.co", "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2");
let allVehicles = [], allDrivers = [], globalOrders = [];

async function fetchData() {
    const { data: v } = await supabase.from('vehicles').select('*');
    const { data: d } = await supabase.from('drivers').select('*');
    const { data: o } = await supabase.from('orders').select('*').order('date', {ascending:false});
    allVehicles = v || []; allDrivers = d || []; globalOrders = o || [];
    renderAll();
}

function renderAll() {
    document.getElementById('driversTableBody').innerHTML = allDrivers.map(d => `<tr><td>${d.name}</td><td>${d.password}</td><td><button class="action-icon" onclick="openEditDriverModal('${d.id}','${d.password}')"><i class="fa-solid fa-pen"></i></button></td></tr>`).join('');
    document.getElementById('vehiclesTableBody').innerHTML = allVehicles.map(v => `<tr><td>${v.model}</td><td>${v.plate}</td><td><button class="action-icon" onclick="deleteVehicle('${v.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    document.getElementById('ordersTableBody').innerHTML = globalOrders.map(o => `<tr><td>${o.date}</td><td>${o.departure} > ${o.destination}</td><td>${o.driver_name}</td><td>${o.status}</td><td><button class="action-icon" onclick="deleteOrder('${o.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
    
    const dOpts = allDrivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    document.getElementById('assignedDriver').innerHTML = dOpts;
    
    const stats = document.getElementById('driverStatsContainer');
    stats.innerHTML = allDrivers.map(d => {
        const total = globalOrders.filter(o => o.driver_name === d.name && o.status === 'depose').reduce((s, o) => s + (parseFloat(o.price)||0), 0);
        return `<div><strong>${d.name}</strong> : ${total.toFixed(2)} €</div>`;
    }).join('');
}

document.getElementById('driverForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('drivers').insert({name: document.getElementById('driverName').value, password: document.getElementById('driverPassword').value});
    fetchData();
};

document.getElementById('vehicleForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('vehicles').insert({model: document.getElementById('vehicleModel').value, plate: document.getElementById('vehiclePlate').value});
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

async function deleteVehicle(id) { await supabase.from('vehicles').delete().eq('id', id); fetchData(); }
async function deleteOrder(id) { await supabase.from('orders').delete().eq('id', id); fetchData(); }

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
        status: 'attente'
    });
    fetchData();
};

fetchData();
