// Explicit links into the search area may open it; normal visits stay collapsed.
function openDirectoryTarget() {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (!id) return;
  const directory = document.getElementById('directory');
  const target = document.getElementById(id);
  if (!directory || directory.hidden || !target || !directory.contains(target)) return;
  directory.open = true;
  requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

openDirectoryTarget();
window.addEventListener('hashchange', openDirectoryTarget);
