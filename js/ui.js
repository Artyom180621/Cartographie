/* ============================================
   UI - Sidebar, tabs, toasts, modals
   ============================================ */

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`tab-${tab}`).style.display = 'block';
}

function showExportModal() { document.getElementById('export-modal').classList.add('show'); }
function closeExportModal() { document.getElementById('export-modal').classList.remove('show'); }

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setupNetworkStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const update = () => {
    if (navigator.onLine) { dot.className = 'status-dot online'; text.textContent = 'En ligne'; }
    else { dot.className = 'status-dot offline'; text.textContent = 'Hors ligne'; }
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
