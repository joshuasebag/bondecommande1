// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";

let supabaseClient;

// Initialisation de Supabase
try {
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        throw new Error("La bibliothèque Supabase n'est pas encore chargée.");
    }
} catch (err) {
    console.error("Erreur Supabase :", err);
}

const coursesContainer = document.getElementById('coursesContainer');
const connStatus = document.getElementById('connection-status');

const currentDriver = "Michel";
let allVehicles = [];

// Statut de connexion
if (supabaseClient) {
    if (connStatus) {
        connStatus.innerHTML = '<span style="color:#10b981;">● En ligne</span>';
    }
} else {
    if (connStatus) {
        connStatus.innerHTML = '<span style="color:#ef4444;">● Erreur de chargement SDK</span>';
    }
}

// Charger tous les véhicules pour faire la correspondance
async function fetchVehicles() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('vehicles').select('*');
        if (error) throw error;
        allVehicles = data || [];
    } catch (err) {
        console.error("Erreur de récupération des véhicules :", err);
    }
}

// Charger l'ensemble des courses de Michel
async function fetchDriverCourses() {
    if (!supabaseClient) return;

    try {
        const { data: courses, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('driver_name', currentDriver)
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw error;
        renderCourses(courses);
    } catch (error) {
        console.error("Erreur courses :", error);
        coursesContainer.innerHTML = '<div class="no-courses">Erreur de chargement des données.</div>';
    }
}

// Générer le texte formaté du Bon de Commande
function generateMissionText(course) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = course.date ? new Date(course.date).toLocaleDateString('fr-FR', options) : 'Date inconnue';
    
    const creationDate = course.created_at ? new Date(course.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const creationTime = course.created_at ? new Date(course.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '21h00';

    const dateCapitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    // Recherche dynamique du véhicule relié
    const veh = allVehicles.find(v => v.id === course.vehicle_id);
    const vehicleModel = veh ? veh.model : 'Mercedes Class V';
    const vehiclePlate = veh ? veh.plate : 'Non spécifiée';
    const vehiclePhone = veh ? veh.phone : '+33661376190';

    return `VOTRE MISSION - SERVICE COMMANDÉ : ${course.service_type ? course.service_type.toUpperCase() : 'VAN'}
-------------------------
Date et heure : ${dateCapitalized} à ${course.time || '--:--'}

Départ : ${course.departure || 'Non spécifié'}

Destination : ${course.destination || 'Non spécifiée'}

client : ${course.client_name || 'Non spécifié'}
Tel : ${course.client_phone || ''}  (${course.passengers || 1} pax)

Chauffeur : ${course.driver_name || 'Non assigné'}
${vehiclePhone}
${vehicleModel}
${vehiclePlate}

Tarif sous-traitant : ${course.price || '0'}€ ttc PP

Infos : ${course.info || 'Aucune'}
Commandé le ${creationDate} à ${creationTime}

Nous vous remercions pour votre confiance.
-------------------------
 
Fernand Michel Sebag
En cas de besoin : +33661376190
Siret 90776001100029`;
}

// Copier / partager la mission
async function shareMission(courseId, courseData) {
    const course = JSON.parse(decodeURIComponent(courseData));
    const text = generateMissionText(course);

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Votre Mission VTC',
                text: text
            });
            return;
        } catch (err) {
            console.log("Partage natif ignoré.");
        }
    }

    try {
        await navigator.clipboard.writeText(text);
        alert("Mission copiée dans le presse-papiers !");
    } catch (err) {
        alert("Impossible de copier automatiquement.");
    }
}

// Générer les cartes
function renderCourses(courses) {
    if (!coursesContainer) return;
    coursesContainer.innerHTML = '';

    if (!courses || courses.length === 0) {
        coursesContainer.innerHTML = '<div class="no-courses">Aucune course enregistrée pour Michel.</div>';
        return;
    }

    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';

        let actionButtonHTML = '';
        let badgeHTML = '';

        if (course.status === 'attente') {
            badgeHTML = '<span class="badge-status status-attente">En attente</span>';
            actionButtonHTML = `
                <button class="btn-action btn-pickup" onclick="updateCourseStatus('${course.id}', 'charge')">
                    <i class="fa-solid fa-street-view"></i> Valider Prise en Charge
                </button>
            `;
        } else if (course.status === 'charge') {
            badgeHTML = '<span class="badge-status status-charge">Client à bord</span>';
            actionButtonHTML = `
                <button class="btn-action btn-dropoff" onclick="updateCourseStatus('${course.id}', 'depose')">
                    <i class="fa-solid fa-flag-checkered"></i> Valider la Dépose
                </button>
            `;
        } else if (course.status === 'depose') {
            badgeHTML = '<span class="badge-status status-depose">Terminé</span>';
            actionButtonHTML = `<div style="text-align:center; color:#10b981; font-weight:bold; font-size:14px;"><i class="fa-solid fa-circle-check"></i> Course complétée</div>`;
        }

        const safeCourseData = encodeURIComponent(JSON.stringify(course));
        const courseDateFormated = course.date ? new Date(course.date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}) : 'Date inconnue';

        // Afficher également le modèle et la plaque sur la carte du chauffeur
        const assignedVeh = allVehicles.find(v => v.id === course.vehicle_id);
        const vehicleDisplay = assignedVeh ? `${assignedVeh.model} (${assignedVeh.plate})` : 'Aucun véhicule assigné';

        card.innerHTML = `
            <div class="course-header">
                <span class="course-time"><i class="fa-regular fa-calendar"></i> ${courseDateFormated} à ${course.time}</span>
                ${badgeHTML}
            </div>
            
            <div class="address-block">
                <div class="address-item" style="color: #f1f5f9;"><i class="fa-solid fa-circle" style="color:#2563eb; font-size:10px;"></i> <strong>Départ :</strong> ${course.departure}</div>
                <div class="address-item" style="color: #f1f5f9;"><i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:12px;"></i> <strong>Destination :</strong> ${course.destination}</div>
            </div>

            <div class="client-info">
                <div><i class="fa-solid fa-user"></i> <strong>Client :</strong> ${course.client_name}</div>
                <div style="margin-top:4px;"><i class="fa-solid fa-phone"></i> <a href="tel:${course.client_phone}" style="color:#38bdf8; text-decoration:none;">${course.client_phone}</a> (${course.passengers} pax)</div>
                <div style="margin-top:8px; color:#e2e8f0;"><i class="fa-solid fa-car"></i> <strong>Véhicule :</strong> ${vehicleDisplay}</div>
                ${course.info ? `<div style="margin-top:8px; font-style:italic; color:#94a3b8;">Note : ${course.info}</div>` : ''}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <span style="color:var(--text-secondary); font-size:13px;">Service: ${course.service_type}</span>
                <span class="course-price">${course.price} €</span>
            </div>

            <div style="margin-bottom: 12px;">
                <button class="btn-action" style="background-color: #475569; color: white;" onclick="shareMission('${course.id}', '${safeCourseData}')">
                    <i class="fa-solid fa-share-nodes"></i> Copier / Partager la Mission
                </button>
            </div>

            <div class="action-container">
                ${actionButtonHTML}
            </div>
        `;

        coursesContainer.appendChild(card);
    });
}

// Mise à jour de statut
async function updateCourseStatus(courseId, newStatus) {
    if (!supabaseClient) return;
    
    const updateData = { status: newStatus };

    if (newStatus === 'charge') {
        updateData.pickup_time = new Date().toISOString();
    } else if (newStatus === 'depose') {
        updateData.dropoff_time = new Date().toISOString();
    }

    try {
        const { error } = await supabaseClient.from('orders').update(updateData).eq('id', courseId);
        if (error) throw error;
        fetchDriverCourses();
    } catch (error) {
        alert("Erreur mise à jour : " + error.message);
    }
}

// Lancement global
async function init() {
    await fetchVehicles();
    await fetchDriverCourses();

    if (supabaseClient) {
        supabaseClient
            .channel('driver-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDriverCourses())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
                fetchVehicles().then(() => fetchDriverCourses());
            })
            .subscribe();
    }
}

init();
