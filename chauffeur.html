const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";
let supabaseClient;
try { if (typeof window !== "undefined" && window.supabase) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (err) {}

let currentDriver = null;
let allVehicles = [];

// --- GESTION DE LA CONNEXION ---
const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');

function checkSession() {
    const saved = sessionStorage.getItem('logged_driver');
    if (saved) {
        currentDriver = saved;
        document.getElementById('displayDriverName').innerText = currentDriver;
        loginSection.style.display = 'none';
        appSection.style.display = 'block';
        initApp();
    }
}
checkSession();

document.getElementById('driverLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!supabaseClient) return;
    const name = document.getElementById('loginName').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();

    const { data, error } = await supabaseClient.from('drivers').select('*').eq('name', name).eq('password', pass);
    
    if (data && data.length > 0) {
        sessionStorage.setItem('logged_driver', data[0].name);
        checkSession();
    } else {
        alert("Identifiant ou mot de passe incorrect.");
    }
});

function logoutDriver() {
    sessionStorage.removeItem('logged_driver');
    location.reload();
}

// --- LOGIQUE APPLICATION ---
async function initApp() {
    await fetchVehicles();
    await fetchDriverCourses();
    if (supabaseClient) {
        supabaseClient.channel('driver-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDriverCourses())
            .subscribe();
    }
}

async function fetchVehicles() {
    const { data } = await supabaseClient.from('vehicles').select('*');
    allVehicles = data || [];
}

async function fetchDriverCourses() {
    const { data: courses } = await supabaseClient.from('orders').select('*').eq('driver_name', currentDriver).order('date', { ascending: true }).order('time', { ascending: true });
    renderCourses(courses || []);
}

function generateMissionText(course) {
    const fDate = course.date ? new Date(course.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const v = allVehicles.find(v => v.id === course.vehicle_id);
    return `VOTRE MISSION - SERVICE COMMANDÉ : ${course.service_type||'VAN'}\n-------------------------\nDate/Heure : ${fDate} à ${course.time}\nDépart : ${course.departure}\nDestination : ${course.destination}\n\nClient : ${course.client_name} - ${course.client_phone}\n\nTarif : ${course.price}€\n-------------------------`;
}

async function shareMission(courseId, courseData) {
    const text = generateMissionText(JSON.parse(decodeURIComponent(courseData)));
    if (navigator.share) { try { await navigator.share({ text: text }); return; } catch(e){} }
    try { await navigator.clipboard.writeText(text); alert("Copié !"); } catch(e){}
}

function renderCourses(courses) {
    const container = document.getElementById('coursesContainer');
    container.innerHTML = courses.length === 0 ? '<div class="no-courses">Aucune course pour vous.</div>' : '';
    
    courses.forEach(course => {
        let btn = '', badge = '';
        if (course.status === 'attente') { badge = '<span class="badge-status status-attente">En attente</span>'; btn = `<button class="btn-action btn-pickup" onclick="updateCourseStatus('${course.id}', 'charge')"><i class="fa-solid fa-street-view"></i> Prise en Charge</button>`; } 
        else if (course.status === 'charge') { badge = '<span class="badge-status status-charge">Client à bord</span>'; btn = `<button class="btn-action btn-dropoff" onclick="updateCourseStatus('${course.id}', 'depose')"><i class="fa-solid fa-flag-checkered"></i> Valider Dépose</button>`; } 
        else { badge = '<span class="badge-status status-depose">Terminé</span>'; btn = `<div style="text-align:center; color:#10b981; font-weight:bold;"><i class="fa-solid fa-check"></i> Complétée</div>`; }

        const safeD = encodeURIComponent(JSON.stringify(course));
        const dF = course.date ? new Date(course.date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}) : '';
        const v = allVehicles.find(x => x.id === course.vehicle_id);

        container.innerHTML += `<div class="course-card">
            <div class="course-header"><span class="course-time">${dF} à ${course.time}</span>${badge}</div>
            <div class="address-block">
                <div style="color:white; margin-bottom:6px;"><i class="fa-solid fa-circle" style="color:#2563eb; font-size:10px;"></i> ${course.departure}</div>
                <div style="color:white;"><i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:12px;"></i> ${course.destination}</div>
            </div>
            <div class="client-info">
                <div><i class="fa-solid fa-user"></i> ${course.client_name} - <a href="tel:${course.client_phone}" style="color:#38bdf8;">${course.client_phone}</a></div>
                <div style="margin-top:8px; color:white;"><i class="fa-solid fa-car"></i> ${v ? v.model + ' (' + v.plate + ')' : 'Aucun véhicule'}</div>
                ${course.info ? `<div style="margin-top:8px; font-style:italic;">Note: ${course.info}</div>` : ''}
            </div>
            <button class="btn-action" style="background:#475569; margin-bottom:12px;" onclick="shareMission('${course.id}', '${safeD}')"><i class="fa-solid fa-share-nodes"></i> Partager</button>
            ${btn}
        </div>`;
    });
}

async function updateCourseStatus(id, st) {
    await supabaseClient.from('orders').update({ status: st }).eq('id', id);
    fetchDriverCourses();
}
