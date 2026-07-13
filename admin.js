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
    console.error("Erreur d'initialisation Supabase dans admin.js :", err);
}

// --- AUTOCOMPLÉTION DES ADRESSES ---
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

// Configurer l'autocomplétion sur la création ET la modification
setupAutocomplete('departure', 'departure-suggestions');
setupAutocomplete('destination', 'destination-suggestions');
setupAutocomplete('editDeparture', 'editDeparture-suggestions');
setupAutocomplete('editDestination', 'editDestination-suggestions');


// --- GÉNÉRER LE TEXTE FORMATÉ DU BON DE COMMANDE ---
function generateMissionText(order) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = order.date ? new Date(order.date).toLocaleDateString('fr-FR', options) : 'Date inconnue';
    
    const creationDate = order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    const creationTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '21h00';

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

// --- COPIER / PARTAGER LA MISSION ---
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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">Aucune course enregistrée.</td></tr>`;
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            
            let badgeClass = 'badge-attente';
            let statusLabel = 'En attente';
            if (order.status === 'charge') {
                badgeClass = 'badge-charge';
                statusLabel = 'Pris en charge';
            } else if (order.status === 'depose') {
                badgeClass = 'badge-depose';
                statusLabel = 'Déposé';
            }

            const safeOrderData = encodeURIComponent(JSON.stringify(order));

            // Formatage propre de la date pour le tableau
            const dateFormatted = order.date ? new Date(order.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}) : '--/--';

            tr.innerHTML = `
                <td><strong>${dateFormatted}</strong> à ${order.time}</td>
                <td><i class="fa-solid fa-user-tie" style="color: var(--primary); margin-right: 4px;"></i> ${order.driver_name || 'Non assigné'}</td>
                <td>
                    <div style="font-size:12px; font-weight: 500; color: var(--text-main);"><i class="fa-solid fa-circle" style="color:var(--primary); font-size:8px; margin-right:4px;"></i> ${order.departure}</div>
                    <div style="font-size:12px; font-weight: 500; color: var(--text-main); margin-top: 4px;"><i class="fa-solid fa-location-dot" style="color:var(--danger); font-size:9px; margin-right:4px;"></i> ${order.destination}</div>
                </td>
                <td>
                    <strong>${order.client_name}</strong>
                    <div style="font-size:11px; color: var(--text-muted); margin-top:2px;"><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${order.client_phone}</div>
                </td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td>
                    <div class="action-btn-row">
                        <!-- COPIER / PARTAGER -->
                        <button class="action-icon action-share" onclick="shareMissionFromAdmin('${safeOrderData}')" title="Copier/Partager">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                        <!-- MODIFIER -->
                        <button class="action-icon action-edit" onclick="openEditModal('${safeOrderData}')" title="Modifier">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <!-- SUPPRIMER -->
                        <button class="action-icon action-delete" onclick="deleteOrder('${order.id}')" title="Supprimer">
                            <i class="fa-solid fa-trash-can"></i>
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


// --- SUPPRIMER UNE COURSE ---
async function deleteOrder(orderId) {
    if (!supabaseClient) return;
    
    const confirmDelete = confirm("Êtes-vous sûr de vouloir supprimer définitivement cette course ?");
    if (!confirmDelete) return;

    try {
        const { error } = await supabaseClient
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (error) throw error;
        fetchAndDisplayOrders();
    } catch (error) {
        alert("Erreur de suppression : " + error.message);
    }
}


// --- GESTION DU POP-UP DE MODIFICATION (MODAL) ---
const editModal = document.getElementById('editModal');

function openEditModal(orderData) {
    const order = JSON.parse(decodeURIComponent(orderData));

    // Remplir les champs du pop-up avec les valeurs existantes
    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editServiceType').value = order.service_type || 'Transfert';
    document.getElementById('editPrice').value = order.price || 0;
    document.getElementById('editDate').value = order.date || '';
    document.getElementById('editTime').value = order.time || '';
    document.getElementById('editDeparture').value = order.departure || '';
    document.getElementById('editDestination').value = order.destination || '';
    document.getElementById('editClientName').value = order.client_name || '';
    document.getElementById('editClientPhone').value = order.client_phone || '';
    document.getElementById('editPassengers').value = order.passengers || 1;
    document.getElementById('editAssignedDriver').value = order.driver_name || '';
    document.getElementById('editStatus').value = order.status || 'attente';
    document.getElementById('editInfo').value = order.info || '';

    // Afficher le modal
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
}

// Fermer si clic en dehors du formulaire
window.onclick = function(event) {
    if (event.target == editModal) {
        closeEditModal();
    }
}

// Soumission des modifications
const editOrderForm = document.getElementById('editOrderForm');
if (editOrderForm) {
    editOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!supabaseClient) return;

        const orderId = document.getElementById('editOrderId').value;
        const updatedOrder = {
            service_type: document.getElementById('editServiceType').value,
            price: parseFloat(document.getElementById('editPrice').value),
            date: document.getElementById('editDate').value,
            time: document.getElementById('editTime').value,
            departure: document.getElementById('editDeparture').value,
            destination: document.getElementById('editDestination').value,
            client_name: document.getElementById('editClientName').value,
            client_phone: document.getElementById('editClientPhone').value,
            passengers: parseInt(document.getElementById('editPassengers').value),
            driver_name: document.getElementById('editAssignedDriver').value,
            status: document.getElementById('editStatus').value,
            info: document.getElementById('editInfo').value
        };

        try {
            const { error } = await supabaseClient
                .from('orders')
                .update(updatedOrder)
                .eq('id', orderId);

            if (error) throw error;

            alert("Course mise à jour avec succès !");
            closeEditModal();
            fetchAndDisplayOrders();
        } catch (error) {
            alert("Erreur lors de la mise à jour : " + error.message);
        }
    });
}


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
            fetchAndDisplayOrders();
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
