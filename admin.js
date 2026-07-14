const supabase = supabase.createClient("https://vvdfxcnxzwcidxtzqfgx.supabase.co", "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2");
let drivers = [], vehicles = [], orders = [];

async function load() {
    const { data: d } = await supabase.from('drivers').select('*');
    const { data: v } = await supabase.from('vehicles').select('*');
    const { data: o } = await supabase.from('orders').select('*');
    drivers = d || []; vehicles = v || []; orders = o || [];
    render();
}

function render() {
    // Chauffeurs + Bouton Modifier
    document.getElementById('dBody').innerHTML = drivers.map(d => 
        `<tr><td>${d.name}</td><td>${d.password}</td>
        <td><button onclick="openM('${d.id}', '${d.password}')"><i class="fa-solid fa-pen"></i></button></td></tr>`
    ).join('');
    
    // Véhicules
    document.getElementById('vBody').innerHTML = vehicles.map(v => 
        `<tr><td>${v.model}</td><td>${v.plate}</td></tr>`
    ).join('');

    // Courses
    document.getElementById('oBody').innerHTML = orders.map(o => 
        `<tr><td>${o.departure}</td><td>${o.driver_name}</td></tr>`
    ).join('');

    // Stats CA
    document.getElementById('stats').innerHTML = drivers.map(d => {
        const total = orders.filter(o => o.driver_name === d.name && o.status === 'depose').reduce((s, o) => s + (parseFloat(o.price)||0), 0);
        return `<div style="padding:10px; border:1px solid #eee;"><strong>${d.name}</strong><br>${total.toFixed(2)}€</div>`;
    }).join('');
}

function openM(id, pass) {
    document.getElementById('editId').value = id;
    document.getElementById('editPass').value = pass;
    document.getElementById('modal').style.display = 'flex';
}

async function savePass() {
    await supabase.from('drivers').update({password: document.getElementById('editPass').value}).eq('id', document.getElementById('editId').value);
    document.getElementById('modal').style.display = 'none';
    load();
}

document.getElementById('driverForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('drivers').insert({name: document.getElementById('dName').value, password: document.getElementById('dPass').value});
    load();
};

load();
