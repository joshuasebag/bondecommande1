// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";

let supabaseClient;

// Initialisation ultra-robuste de Supabase pour éviter tout conflit de nom de variable
try {
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        throw new Error("La bibliothèque Supabase n'est pas encore chargée dans le navigateur.");
    }
} catch (err) {
    console.error("Erreur d'initialisation Supabase dans admin.js :", err);
}

// --- AUTOCOMPLÉTION DES ADRESSES (API GOUVERNEMENT) ---
const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsId);

    if (!input || !suggestionsContainer) return;

    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 3) {
            suggestionsContainer.style.display = 'none';
            return;
        }

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
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error("Erreur adresses :", error);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    });
};

setupAutocomplete('departure', 'departure-suggestions');
setupAutocomplete('destination', 'destination-suggestions');


// --- GÉNÉRER LE TEXTE FORMATÉ DU BON DE COMMANDE ---
function generateMissionText(order) {
    // Formatage de la date en français (ex: Dimanche 21 juin 2026)
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = order.date ? new Date(order.date).toLocaleDateString('fr-FR', options) : 'Date inconnue';
    
    // Formatage de la date de création de la commande
    const creationDate = order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const creationTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '21h00';

    // Majuscule sur le jour de la semaine
    const dateCapitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    return `VOTRE MISSION - SERVICE COMMANDÉ : ${order.service_type ? order.service_type.toUpperCase() : 'VAN'}
-------------------------
Date et heure : ${dateCapitalized} à ${order.time || '--:--'}

Départ : ${order.departure || 'Non spécifié'}

Destination : ${order.destination || 'Non spécifiée'}

client : ${order.client_name || 'Non spécifié'}
Tel : ${order.client_phone || ''}  (${order.passengers || 1} pax)

Chauffeur : ${order.driver_name || 'Non assigné'}
0661376190
Mercedes Class V
HB190LY

Tarif sous-traitant : ${order.price || '0'}€ ttc PP

Infos : ${order.info || 'Aucune'}
Commandé le ${creationDate} à ${creationTime}

Nous vous remercions pour votre confiance.
-------------------------
 
Fernand Michel Sebag
En cas de besoin : +33661376190
Siret 90776001100029`;
}

// --- COPIER / PARTAGER LA MISSION (DEPUIS L'ADMIN) ---
async function shareMissionFromAdmin(orderData) {
    const order = JSON.parse(decodeURIComponent(orderData));
    const text = generateMissionText(order);

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Mission VTC Envoyée',
                text: text
            });
            return;
        } catch (err) {
            console.log("Partage annulé ou non disponible.");
        }
    }

    // Solution de secours : copie automatique
    try {
        await navigator.clipboard.writeText(text);
        alert("Bon de commande formaté copié dans le presse-papiers !");
    } catch (err) {
        alert("Échec de la copie automatique.");
    }
}


// --- RÉCUPÉRATION ET AFFICHAGE DES COURSES ---
const fetchAndDisplayOrders = async () => {
    if (!supabaseClient) return;

    try {
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw error;

        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Aucune course enregistrée.</td></tr>`;
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            
            // Formatage du badge de statut
            let badgeClass = 'badge-attente';
            let statusLabel = 'En attente';
            if (order.status === 'charge') {
                badgeClass = 'badge-charge';
                statusLabel = 'Pris en charge';
            } else if (order.status === 'depose') {
                badgeClass = 'badge-depose';
                statusLabel = 'Déposé';
            }

            // Formatage des heures de prise en charge et dépose
            const pickup = order.pickup_time ? new Date(order.pickup_time).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '--:--';
            const dropoff = order.dropoff_time ? new Date(order.dropoff_time).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '--:--';

            // Sécuriser l'objet de commande pour le passer au bouton de partage
            const safeOrderData = encodeURIComponent(JSON.stringify(order));

            tr.innerHTML = `
                <td><strong>${new Date(order.date).toLocaleDateString('fr-FR')}</strong> à ${order.time}</td>
                <td><i class="fa-solid fa-user-tie"></i> ${order.driver_name || 'Non assigné'}</td>
                <td>
                    <div style="font-size:12px; color:#475569;"><strong>Départ:</strong> ${order.departure}</div>
                    <div style="font-size:12px; color:#475569;"><strong>Dest:</strong> ${order.destination}</div>
                </td>
                <td>${order.client_name} <br> <span style="font-size:11px; color:#64748b;">${order.client_phone}</span></td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span style="font-size:11px; line-height:1.4;">
                            🏁 PC: ${pickup}<br>
                            🛑 DP: ${dropoff}
                        </span>
                        <!-- BOUTON DE PARTAGE DE MISSION RAPIDE -->
                        <button onclick="shareMissionFromAdmin('${safeOrderData}')" title="Copier/Partager la mission" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; padding:6px 10px; border-radius:6px; cursor:pointer; transition:all 0.2s;">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Erreur de récupération :", error);
    }
};


// --- SOUMISSION DU FORMULAIRE (CRÉATION DE COURSE) ---
const orderForm = document.getElementById('orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
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
            info: document.getElementById('info').value,
            status: 'attente'
        };

        try {
            const { error } = await supabaseClient
                .from('orders')
                .insert([newOrder]);

            if (error) throw error;

            alert("Bon de commande envoyé avec succès !");
            orderForm.reset();
            fetchAndDisplayOrders(); // Recharger la liste
        } catch (error) {
            alert("Erreur lors de la création de la course : " + error.message);
        }
    });
}


// --- ABONNEMENT TEMPS RÉEL (REALTIME) ---
if (supabaseClient) {
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            console.log('Changement détecté en temps réel !', payload);
            fetchAndDisplayOrders();
        })
        .subscribe();
}


// Premier chargement au lancement de la page
fetchAndDisplayOrders();
