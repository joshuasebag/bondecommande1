// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = "https://vvdfxcnxzwcidxtzqfgx.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_sQLbXaT_zCNinhTaXd7Iiw_KsKIAeS2";

// Initialisation du client Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- AUTOCOMPLÉTION DES ADRESSES (API GOUVERNEMENT) ---
const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsId);

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


// --- RÉCUPÉRATION ET AFFICHAGE DES COURSES ---
const fetchAndDisplayOrders = async () => {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

    if (error) {
        console.error("Erreur de récupération :", error);
        return;
    }

    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';

    if (orders.length === 0) {
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

        tr.innerHTML = `
            <td><strong>${new Date(order.date).toLocaleDateString('fr-FR')}</strong> à ${order.time}</td>
            <td><i class="fa-solid fa-user-tie"></i> ${order.driver_name || 'Non assigné'}</td>
            <td>
                <div style="font-size:12px; color:#475569;"><strong>Départ:</strong> ${order.departure}</div>
                <div style="font-size:12px; color:#475569;"><strong>Dest:</strong> ${order.destination}</div>
            </td>
            <td>${order.client_name} <br> <span style="font-size:11px; color:#64748b;">${order.client_phone}</span></td>
            <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
            <td style="font-size:12px;">
                🏁 PC: ${pickup}<br>
                🛑 DP: ${dropoff}
            </td>
        `;
        tbody.appendChild(tr);
    });
};


// --- SOUMISSION DU FORMULAIRE (CRÉATION DE COURSE) ---
const orderForm = document.getElementById('orderForm');
orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

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

    const { error } = await supabase
        .from('orders')
        .insert([newOrder]);

    if (error) {
        alert("Erreur lors de la création de la course : " + error.message);
    } else {
        alert("Bon de commande envoyé avec succès !");
        orderForm.reset();
        fetchAndDisplayOrders(); // Recharger la liste
    }
});


// --- ABONNEMENT TEMPS RÉEL (REALTIME) ---
supabase
    .channel('schema-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        console.log('Changement détecté en temps réel !', payload);
        fetchAndDisplayOrders();
    })
    .subscribe();


// Premier chargement au lancement de la page
fetchAndDisplayOrders();
