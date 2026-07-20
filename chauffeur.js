const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";

// Initialisation robuste (retrait du "try/catch" silencieux qui bloquait le bouton)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentDriver = null;
let allVehicles = [];

// --- GESTION DE LA CONNEXION ---
const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');

function checkSession() {
    const saved = sessionStorage.getItem('logged_driver');
    if (saved) {
        currentDriver = saved;
        if (loginSection) loginSection.style.display = 'none';
        if (appSection) appSection.style.display = 'block';
        initApp();
    }
}
checkSession();

const driverLoginForm = document.getElementById('driverLoginForm');
if (driverLoginForm) {
    driverLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('loginName');
        const passInput = document.getElementById('loginPassword');
        
        if (!nameInput || !passInput) return;

        const name = nameInput.value.trim();
        const pass = passInput.value.trim();

        try {
            const { data, error } = await supabaseClient
                .from('drivers')
                .select('*')
                .eq('name', name)
                .eq('password', pass);
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                sessionStorage.setItem('logged_driver', data[0].name);
                checkSession();
            } else {
                alert("Identifiant ou mot de passe incorrect.");
            }
        } catch (err) {
            console.error("Erreur Supabase lors de la connexion :", err);
            alert("Erreur réseau ou base de données. Veuillez réessayer.");
        }
    });
}

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
    if (!container) return;
    
    container.innerHTML = courses.length === 0 ? '<div class="no-courses">Aucune course pour vous.</div>' : '';
    
    courses.forEach(course => {
        
        // Formatage de la date en JJ/MM/AAAA (Comme sur la photo)
        let dF = '';
        if(course.date) {
            const parts = course.date.split('-');
            if(parts.length === 3) dF = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // Statut et Bouton Principal
        let btn = '', badge = '';
        if (course.status === 'attente') { 
            badge = '<span class="shimon-badge">PLANIFIÉE</span>'; 
            btn = `<button class="btn-main-action" onclick="updateCourseStatus('${course.id}', 'charge')"><i class="fa-solid fa-lock" style="color:#b38b59; margin-right:8px;"></i> Démarrer la course</button>`; 
        } 
        else if (course.status === 'charge') { 
            badge = '<span class="shimon-badge" style="background:#e0f2fe; color:#0369a1;">À BORD</span>'; 
            btn = `<button class="btn-main-action" onclick="updateCourseStatus('${course.id}', 'depose')"><i class="fa-solid fa-flag-checkered" style="color:#0369a1; margin-right:8px;"></i> Valider la Dépose</button>`; 
        } 
        else { 
            badge = '<span class="shimon-badge" style="background:#e6f4ea; color:#15803d;">TERMINÉE</span>'; 
            btn = `<div style="text-align:center; color:#10b981; font-weight:bold; margin-top:10px; padding:14px;"><i class="fa-solid fa-check"></i> Course complétée</div>`; 
        }

        const safeD = encodeURIComponent(JSON.stringify(course)).replace(/'/g, "%27");
        const v = allVehicles.find(x => x.id === course.vehicle_id);
        
        const paxInfo = course.passengers ? course.passengers : '1';
        const vehicleText = v ? v.model + ' (' + v.plate + ')' : 'Non assigné';

        // Liens Waze et Agenda
        const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(course.destination)}`;
        const dateISO = course.date ? course.date.replace(/-/g, '') : '';
        let timeISO = course.time ? course.time.replace(/:/g, '') : '000000';
        if (timeISO.length === 4) timeISO += '00';
        const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=Course+${encodeURIComponent(course.client_name)}&dates=${dateISO}T${timeISO}/${dateISO}T${timeISO}&details=Client:+${encodeURIComponent(course.client_name)}+-+Tel:+${encodeURIComponent(course.client_phone)}&location=${encodeURIComponent(course.destination)}`;

        container.innerHTML += `
        <div class="course-card">
            <div class="shimon-header">
                <div>
                    <div class="shimon-time">${course.time}</div>
                    <div class="shimon-date">${dF}</div>
                </div>
                <div>
                    <div class="shimon-price">${course.price} €</div>
                    ${badge}
                </div>
            </div>

            <div class="shimon-client">${course.client_name}</div>

            <div class="shimon-addresses">
                <div class="addr-block">${course.departure}</div>
                <div class="addr-arrow">→</div>
                <div class="addr-block">${course.destination}</div>
            </div>

            <div class="shimon-details">
                <span><i class="fa-solid fa-user"></i> ${paxInfo} pers.</span>
                <span><i class="fa-solid fa-suitcase"></i> ${vehicleText}</span>
            </div>
            
            <div class="shimon-details">
                <i class="fa-solid fa-phone"></i> 
                <a href="tel:${course.client_phone}" style="color: inherit; text-decoration: none;">${course.client_phone}</a>
            </div>

            ${course.info ? `<div class="shimon-notes">📝 ${course.info}</div>` : ''}

            <div class="shimon-buttons">
                ${btn}
                <a href="${gCalUrl}" target="_blank" class="btn-shimon"><i class="fa-regular fa-calendar"></i> Ajouter à mon agenda</a>
                <button class="btn-shimon" onclick="shareMission('${course.id}', '${safeD}')"><i class="fa-regular fa-comment"></i> Messages (Partager)</button>
                <a href="${wazeUrl}" target="_blank" class="btn-shimon"><i class="fa-regular fa-compass"></i> Ouvrir dans Waze</a>
            </div>
        </div>`;
    });
}

async function updateCourseStatus(id, st) {
    await supabaseClient.from('orders').update({ status: st }).eq('id', id);
    fetchDriverCourses();
}
