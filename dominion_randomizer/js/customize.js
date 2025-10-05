document.addEventListener('DOMContentLoaded', async function() {
    await loadExpansions();
    
    const form = document.getElementById('custom-form');
    form?.addEventListener('submit', function(e) {
        e.preventDefault();
        generateCustomKingdom();
    });
});

async function loadExpansions() {
    try {
        const mySetsResponse = await fetch('data/mysets.json');
        const mySets = await mySetsResponse.json();
        
        const allSetsResponse = await fetch('data/dominion_cards.json');
        const allSetsData = await allSetsResponse.json();
        
        const container = document.getElementById('expansions-container');
        if (!container) return;
        
        const savedSelections = JSON.parse(localStorage.getItem('dominionExpansions')) || mySets;
        
        for (const [setId, isOwned] of Object.entries(mySets)) {
            if (!isOwned) continue;
            
            const setData = allSetsData[setId] || { name: setId };
            const isChecked = savedSelections[setId] !== undefined ? savedSelections[setId] : true;
            
            const expansionItem = document.createElement('div');
            expansionItem.className = 'expansion-item';
            expansionItem.innerHTML = `
                <input type="checkbox" id="expansion-${setId}" name="expansions" value="${setId}" ${isChecked ? 'checked' : ''}>
                <label for="expansion-${setId}">${setData.name || setId}</label>
            `;
            
            container.appendChild(expansionItem);
            
            expansionItem.querySelector('input').addEventListener('change', function() {
                const currentSelections = JSON.parse(localStorage.getItem('dominionExpansions')) || mySets;
                currentSelections[this.value] = this.checked;
                localStorage.setItem('dominionExpansions', JSON.stringify(currentSelections));
            });
        }
    } catch (error) {
        console.error('Error loading expansions:', error);
    }
}

function generateCustomKingdom() {
    const selectedExpansions = Array.from(document.querySelectorAll('input[name="expansions"]:checked')).map(cb => cb.value);
    
    const options = {
        spreadCosts: document.getElementById('spreadCosts').checked,
        forceVillage: document.getElementById('forceVillage').checked,
        forceTrashing: document.getElementById('forceTrashing').checked,
        eventChance: document.getElementById('eventChance').value,
        projectChance: document.getElementById('projectChance').value,
        prosperityChance: document.getElementById('prosperityChance').value,
        sheltersChance: document.getElementById('sheltersChance').value
    };
    
    const params = new URLSearchParams();
    selectedExpansions.forEach(set => params.append('expansions', set));
    Object.entries(options).forEach(([key, value]) => {
        if (value) params.append(key, value);
    });
    
    window.location.href = `index.html?${params.toString()}`;
}