// --- AUTOCOMPLÉTION DES ADRESSES (API GOUVERNEMENT) ---
// Cette fonction permet de chercher les adresses en temps réel pendant la saisie

const setupAutocomplete = (inputId, suggestionsId) => {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsId);

    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        
        // On ne cherche que si l'utilisateur a tapé au moins 3 caractères
        if (query.length < 3) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        try {
            // Appel à l'API de géocodage du gouvernement français
            const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();
            
            suggestionsContainer.innerHTML = '';
            
            if (data.features && data.features.length > 0) {
                suggestionsContainer.style.display = 'block';
                
                data.features.forEach(feature => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.textContent = feature.properties.label;
                    
                    // Quand on clique sur une suggestion, on remplit l'input
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
            console.error("Erreur lors de la récupération des adresses :", error);
        }
    });

    // Fermer les suggestions si on clique ailleurs sur la page
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    });
};

// Initialisation de l'autocomplétion sur les champs Départ et Destination
setupAutocomplete('departure', 'departure-suggestions');
setupAutocomplete('destination', 'destination-suggestions');

// --- GESTION DU FORMULAIRE ET DU TABLEAU ---
// (Nous ajouterons ici la connexion à Supabase dès qu'elle sera configurée !)
const orderForm = document.getElementById('orderForm');
orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Formulaire validé ! Nous allons maintenant le connecter à notre base de données.");
});
