// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";

let supabaseClient;

// Initialisation ultra-robuste de Supabase
try {
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        throw new Error("La bibliothèque Supabase n'est pas encore chargée dans le navigateur.");
    }
} catch (err) {
    console.error("Erreur d'initialisation Supabase :", err);
}

const driverSelect = document.getElementById('driverSelect');
const coursesContainer = document.getElementById('coursesContainer');
const connStatus = document.getElementById('connection-status');

let currentDriver = "";

// Si l'initialisation a réussi, on affiche le statut "En ligne"
if (supabaseClient) {
    if (connStatus) {
        connStatus.innerHTML = '<span style="color:#10b981;">● En ligne</span>';
    }
} else {
    if (connStatus) {
        connStatus.innerHTML = '<span style="color:#ef4444;">● Erreur de chargement SDK</span>';
    }
}

// Écouteur de changement de chauffeur
if (driverSelect) {
    driverSelect.addEventListener('change', (e) => {
        currentDriver = e.target.value;
        fetchDriverCourses();
    });
}

// Charger l'ensemble des courses du chauffeur sélectionné
async function fetchDriverCourses() {
    if (!supabaseClient) return;

    if (!currentDriver) {
        coursesContainer.innerHTML = '<div class="no-courses">Veuillez sélectionner un profil de chauffeur pour voir vos courses.</div>';
        return;
    }

    try {
        // CORRECTION : Nous avons enlevé le filtre .eq('date', today) pour charger TOUTES les courses
        const { data: courses, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('driver_name', currentDriver)
            .order('date', { ascending: false }) // Les plus récentes en premier
            .order('time', { ascending: false });

        if (error) throw error;
        renderCourses(courses);
    } catch (error) {
        console.error("Erreur lors de la récupération des courses :", error);
        coursesContainer.innerHTML = '<div class="no-courses">Erreur de chargement des données.</div>';
    }
}

// Générer l'affichage des cartes de courses
function renderCourses(courses) {
    if (!coursesContainer) return;
    coursesContainer.innerHTML = '';

    if (!courses || courses.length === 0) {
        coursesContainer.innerHTML = '<div class="no-courses">Aucune course enregistrée pour ce chauffeur.</div>';
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

        // Formatage lisible de la date de la course
        const courseDateFormated = course.date ? new Date(course.date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}) : 'Date inconnue';

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
                ${course.info ? `<div style="margin-top:6px; font-style:italic; color:#94a3b8;">Note : ${course.info}</div>` : ''}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <span style="color:var(--text-secondary); font-size:13px;">Service: ${course.service_type}</span>
                <span class="course-price">${course.price} €</span>
            </div>

            <div class="action-container">
                ${actionButtonHTML}
            </div>
        `;

        coursesContainer.appendChild(card);
    });
}

// Fonction pour mettre à jour le statut en base de données
async function updateCourseStatus(courseId, newStatus) {
    if (!supabaseClient) return;
    
    const updateData = { status: newStatus };

    if (newStatus === 'charge') {
        updateData.pickup_time = new Date().toISOString();
    } else if (newStatus === 'depose') {
        updateData.dropoff_time = new Date().toISOString();
    }

    try {
        const { error } = await supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', courseId);

        if (error) throw error;
        fetchDriverCourses(); // Recharger la liste locale
    } catch (error) {
        alert("Erreur lors de la mise à jour : " + error.message);
    }
}

// Écoute des changements en direct (Realtime)
if (supabaseClient) {
    supabaseClient
        .channel('driver-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            console.log('Changement détecté !', payload);
            fetchDriverCourses();
        })
        .subscribe();
}
