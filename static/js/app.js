/* ── State ── */
const selectedDrugs = new Set();

/* ── DOM Refs ── */
const drugList     = document.getElementById('drugList');
const chips        = document.getElementById('chips');
const selectedCount= document.getElementById('selectedCount');
const checkBtn     = document.getElementById('checkBtn');
const searchInput  = document.getElementById('searchInput');
const emptyState   = document.getElementById('emptyState');
const resultsContent = document.getElementById('resultsContent');
const loadingState = document.getElementById('loadingState');

/* ── Search ── */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  document.querySelectorAll('.drug-item').forEach(item => {
    const name = item.dataset.drug.toLowerCase();
    item.classList.toggle('hidden', q && !name.includes(q));
  });
});

/* ── Toggle Drug ── */
function toggleDrug(checkbox) {
  const item  = checkbox.closest('.drug-item');
  const drug  = checkbox.value;

  if (checkbox.checked) {
    selectedDrugs.add(drug);
    item.classList.add('selected');
  } else {
    selectedDrugs.delete(drug);
    item.classList.remove('selected');
  }

  refreshChips();
  updateButton();
}

/* ── Chips ── */
function refreshChips() {
  chips.innerHTML = '';
  selectedDrugs.forEach(drug => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `${drug} <span class="chip-remove" onclick="removeDrug('${drug}')">×</span>`;
    chips.appendChild(chip);
  });
  selectedCount.textContent = selectedDrugs.size;
}

function removeDrug(drug) {
  selectedDrugs.delete(drug);
  const checkbox = document.querySelector(`.drug-item[data-drug="${drug}"] input`);
  if (checkbox) {
    checkbox.checked = false;
    checkbox.closest('.drug-item').classList.remove('selected');
  }
  refreshChips();
  updateButton();
}

function updateButton() {
  checkBtn.disabled = selectedDrugs.size < 2;
}

/* ── Severity helpers ── */
const SEVERITY_CONFIG = {
  safe:      { emoji: '✅', label: 'No Dangerous Interactions', color: 'safe' },
  caution:   { emoji: '⚠️', label: 'Use With Caution',          color: 'caution' },
  dangerous: { emoji: '🚨', label: 'Dangerous Combination',     color: 'dangerous' },
};

/* ── Check Interactions ── */
async function checkInteractions() {
  if (selectedDrugs.size < 2) return;

  showLoading(true);

  try {
    const res  = await fetch('/check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ drugs: [...selectedDrugs] }),
    });

    const data = await res.json();
    if (data.error) { alert(data.error); showLoading(false); return; }
    renderResults(data);
  } catch (err) {
    alert('Error communicating with server. Please try again.');
    console.error(err);
    showLoading(false);
  }
}

/* ── Render Results ── */
function renderResults(data) {
  showLoading(false);
  emptyState.style.display   = 'none';
  resultsContent.style.display = 'block';

  const { interactions, overall, alternatives, total_checked, issues_found } = data;
  const cfg = SEVERITY_CONFIG[overall] || SEVERITY_CONFIG.safe;

  /* Verdict */
  const verdictCard   = document.getElementById('verdictCard');
  verdictCard.className = `verdict-card ${cfg.color}`;

  document.getElementById('verdictIcon').textContent   = cfg.emoji;
  document.getElementById('verdictStatus').textContent = cfg.label;
  document.getElementById('verdictMeta').textContent   =
    `${total_checked} pair(s) checked · ${issues_found} interaction(s) found`;
  document.getElementById('verdictBadge').textContent  = overall.toUpperCase();

  /* Interactions count tag */
  document.getElementById('interactionCount').textContent = issues_found;

  /* Interaction cards */
  const list = document.getElementById('interactionsList');
  list.innerHTML = '';

  if (interactions.length === 0) {
    document.getElementById('safeMessage').style.display = 'block';
    document.getElementById('interactionsList').style.display = 'none';
  } else {
    document.getElementById('safeMessage').style.display = 'none';
    document.getElementById('interactionsList').style.display = 'block';

    interactions.forEach(ix => {
      const card = document.createElement('div');
      card.className = `interaction-card ${ix.severity}`;
      card.innerHTML = `
        <div class="ic-header">
          <div class="ic-drugs">
            ${ix.drug1} <span class="ic-plus">+</span> ${ix.drug2}
          </div>
          <span class="badge ${ix.severity}">${ix.severity.toUpperCase()}</span>
        </div>
        <div class="ic-body">${ix.description}</div>
        <div class="ic-mechanism">
          <strong>Mechanism</strong>
          ${ix.mechanism}
        </div>
      `;
      list.appendChild(card);
    });
  }

  /* Alternatives */
  const altSection = document.getElementById('alternativesSection');
  const altList    = document.getElementById('alternativesList');
  altList.innerHTML = '';

  const altKeys = Object.keys(alternatives);
  if (altKeys.length > 0) {
    altSection.style.display = 'block';
    altKeys.forEach(drug => {
      const info = alternatives[drug];
      const card = document.createElement('div');
      card.className = 'alt-card';
      card.innerHTML = `
        <div class="alt-drug-name">Instead of ${capitalize(drug)}</div>
        <div class="alt-category">${info.category}</div>
        <div class="alt-pills">
          ${info.alternatives.map(a => `<span class="alt-pill">${a}</span>`).join('')}
        </div>
      `;
      altList.appendChild(card);
    });
  } else {
    altSection.style.display = 'none';
  }
}

/* ── Helpers ── */
function showLoading(show) {
  loadingState.style.display     = show ? 'flex' : 'none';
  resultsContent.style.display   = show ? 'none' : 'block';
  if (show) emptyState.style.display = 'none';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
