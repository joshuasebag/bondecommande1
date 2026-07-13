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
        throw new Error("La bibliothèque Supabase n'est pas encore chargée dans le navigateur.");
    }
} catch (err) {
    console.error("Erreur d'initialisation Supabase :", err);
}

const driverSelect = document.getElementById('driverSelect');
const coursesContainer = document.getElementById('coursesContainer');
const connStatus = document.getElementById('connection-status');

let currentDriver = "";

// Affichage du statut de connexion
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
        const { data: courses, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('driver_name', currentDriver)
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) throw error;
        renderCourses(courses);
    } catch (error) {
        console.error("Erreur lors de la récupération des courses :", error);
        coursesContainer.innerHTML = '<div class="no-courses">Erreur de chargement des données.</div>';
    }
}

// Générer le texte formaté du Bon de Commande (Exactement selon ton modèle)
function generateMissionText(course) {
    // Formatage de la date en français (ex: Dimanche 21 juin 2026)
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = course.date ? new Date(course.date).toLocaleDateString('fr-FR', options) : 'Date inconnue';
    
    // Formatage de la date de création de la commande
    const creationDate = course.created_at ? new Date(course.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const creationTime = course.created_at ? new Date(course.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '21h00';

    // Majuscule sur le jour de la semaine
    const dateCapitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    return `VOTRE MISSION - SERVICE COMMANDÉ : ${course.service_type ? course.service_type.toUpperCase() : 'VAN'}
-------------------------
Date et heure : ${dateCapitalized} à ${course.time || '--:--'}

Départ : ${course.departure || 'Non spécifié'}

Destination : ${course.destination || 'Non spécifiée'}

client : ${course.client_name || 'Non spécifié'}
Tel : ${course.client_phone || ''}  (${course.passengers || 1} pax)

Chauffeur : ${course.driver_name || 'Non assigné'}
0661376190
Mercedes Class V
HB190LY

Tarif sous-traitant : ${course.price || '0'}€ ttc PP

Infos : ${course.info || 'Aucune'}
Commandé le ${creationDate} à ${creationTime}

Nous vous remercions pour votre confiance.
-------------------------
 
Fernand Michel Sebag
En cas de besoin : +33661376190
Siret 90776001100029`;
}

// Fonction pour copier le texte dans le presse-papiers et le partager
async function shareMission(courseId, courseData) {
    // Reconstruction de l'objet de course depuis la chaîne JSON
    const course = JSON.parse(decodeURIComponent(courseData));
    const text = generateMissionText(course);

    // Essayer d'utiliser le partage natif du téléphone (WhatsApp, SMS, etc.)
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Votre Mission VTC',
                text: text
            });
            return;
        } catch (err) {
            console.log("Partage système annulé ou non disponible, copie dans le presse-papier...");
        }
    }

    // Solution de repli : Copier dans le presse-papiers
    try {
        await navigator.clipboard.writeText(text);
        alert("Mission copiée dans le presse-papiers ! Vous pouvez la coller sur WhatsApp.");
    } catch (err) {
        alert("Impossible de copier automatiquement. Veuillez sélectionner et copier le texte manuellement.");
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

        // Sécuriser le transfert de données d'objet dans la fonction HTML de partage
        const safeCourseData = encodeURIComponent(JSON.stringify(course));

        // Formatage de la date pour la carte
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

            <!-- NOUVEAU BOUTON : PARTAGE PROFESSIONNEL -->
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
