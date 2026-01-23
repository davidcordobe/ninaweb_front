// Página de portafolio: obtiene los datos del backend y renderiza solo las cards de video

(function () {

const isFileProtocol = window.location.protocol === 'file:';
const isDevelopment = isFileProtocol || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PROD_API_BASE_URL = 'https://ninamulti-back.onrender.com';
const API_BASE_URL = isDevelopment ? 'http://localhost:5001' : PROD_API_BASE_URL;

const portfolioGrid = document.getElementById('portfolioGrid');
const portfolioStatus = document.getElementById('portfolioStatus');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
let isMenuOpen = false;

function setStatus(msg) {
    if (!portfolioStatus) return;
    portfolioStatus.textContent = msg;
    portfolioStatus.style.display = msg ? 'block' : 'none';
}

function normalizeImageUrl(url) {
    if (!url) return url;
    const localhostBases = [
        'http://localhost:5001',
        'http://127.0.0.1:5001',
        'https://localhost:5001',
        'https://127.0.0.1:5001'
    ];

    for (const base of localhostBases) {
        if (url.startsWith(base)) {
            return url.replace(base, API_BASE_URL);
        }
    }

    if (url.startsWith('/uploads')) {
        return `${API_BASE_URL}${url}`;
    }

    return url;
}

function normalizeMediaUrl(url) {
    if (!url) return url;
    const localhostBases = [
        'http://localhost:5001',
        'http://127.0.0.1:5001',
        'https://localhost:5001',
        'https://127.0.0.1:5001'
    ];

    for (const base of localhostBases) {
        if (url.startsWith(base)) {
            return url.replace(base, API_BASE_URL);
        }
    }

    if (url.startsWith('/uploads')) {
        return `${API_BASE_URL}${url}`;
    }

    return url;
}

async function apiCall(endpoint) {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(fullUrl);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error HTTP ${response.status}`);
    }
    return response.json();
}

function detectVideoType(url = '') {
    const lowerUrl = (url || '').toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    return 'file';
}

function getVideoMime(url = '') {
    const lower = (url || '').toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.webm')) return 'video/webm';
    return '';
}

function getYoutubeEmbedUrl(url) {
    const id = extractYoutubeId(url);
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

function extractYoutubeId(url = '') {
    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes('youtu.be')) {
            const cleanPath = parsed.pathname.replace(/^\//, '').split('/')[0];
            return cleanPath || null;
        }

        const vParam = parsed.searchParams.get('v');
        if (vParam) return vParam;

        const pathMatch = parsed.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
        if (pathMatch && pathMatch[2]) return pathMatch[2];

        const regex = /(?:v=|\/)([A-Za-z0-9_-]{11})(?:[?&]|$)/;
        const m = url.match(regex);
        if (m && m[1]) return m[1];
    } catch (error) {
        console.warn('No se pudo extraer ID de YouTube:', url);
    }
    return null;
}

function sanitizeVideoUrl(url = '') {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    const id = extractYoutubeId(trimmed);
    if (id) {
        return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }
    return trimmed;
}

function createPlayer(item) {
    const sourceType = detectVideoType(item.videoUrl);
    if (sourceType === 'youtube') {
        const iframe = document.createElement('iframe');
        iframe.src = getYoutubeEmbedUrl(item.videoUrl);
        iframe.title = item.title || 'Reproductor de video';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        return iframe;
    }

    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'metadata';
    if (item.poster) video.poster = normalizeImageUrl(item.poster);

    const source = document.createElement('source');
    source.src = item.videoUrl;
    const mime = getVideoMime(item.videoUrl);
    if (mime) source.type = mime;
    video.appendChild(source);

    const fallback = document.createElement('p');
    fallback.textContent = 'Tu navegador no soporta video HTML5.';
    video.appendChild(fallback);
    return video;
}

function renderPortfolio(items = []) {
    if (!portfolioGrid) return;
    portfolioGrid.innerHTML = '';

    const normalizedItems = (items || []).map(item => {
        const normalizedUrl = normalizeMediaUrl(item?.videoUrl);
        return {
            ...item,
            videoUrl: sanitizeVideoUrl(normalizedUrl)
        };
    });

    const activeItems = normalizedItems.filter(item => item && item.active !== false);
    if (activeItems.length === 0) {
        portfolioGrid.innerHTML = '<div class="portfolio-empty">Aun no hay videos publicados. Agrégalos desde el panel de administración.</div>';
        return;
    }

    activeItems.forEach(item => {
        const card = document.createElement('article');
        card.className = 'portfolio-card';

        const media = document.createElement('div');
        media.className = 'portfolio-media';
        const player = createPlayer(item);
        if (player) media.appendChild(player);

        const body = document.createElement('div');
        body.className = 'portfolio-body';

        const title = document.createElement('h3');
        title.className = 'portfolio-title';
        title.textContent = item.title || 'Video sin titulo';

        const desc = document.createElement('p');
        desc.className = 'portfolio-text';
        desc.textContent = item.description || '';

        const meta = document.createElement('span');
        meta.className = 'portfolio-meta';
        meta.textContent = detectVideoType(item.videoUrl) === 'youtube'
            ? ''
            : '';

        body.appendChild(title);
        body.appendChild(desc);
        body.appendChild(meta);

        card.appendChild(media);
        card.appendChild(body);
        portfolioGrid.appendChild(card);
    });
}

async function loadPortfolio() {
    try {
        setStatus('Cargando portafolio...');
        let data = await apiCall('/api/content/page-data');

        // Si el backend no trae portafolio pero existe uno en localStorage, mantenerlo
        try {
            const localBackup = JSON.parse(localStorage.getItem('pageData') || '{}');
            if ((!data.portfolio || data.portfolio.length === 0) && Array.isArray(localBackup.portfolio) && localBackup.portfolio.length > 0) {
                data.portfolio = localBackup.portfolio;
            }
            if ((!data.portfolio || data.portfolio.length === 0)) {
                const portfolioBackup = JSON.parse(localStorage.getItem('portfolioBackup') || '[]');
                if (Array.isArray(portfolioBackup) && portfolioBackup.length > 0) {
                    data.portfolio = portfolioBackup;
                }
            }
            localStorage.setItem('pageData', JSON.stringify(data));
            localStorage.setItem('portfolioBackup', JSON.stringify(data.portfolio || []));
        } catch (e) {
            console.warn('No se pudo fusionar portafolio local en portfolio.js:', e.message);
        }

        renderPortfolio(data.portfolio || []);
        setStatus('');
    } catch (error) {
        console.error('Error al cargar portafolio:', error);
        setStatus('No se pudo cargar el portafolio. Intenta nuevamente.');
        // Fallback a localStorage
        try {
            const localBackup = JSON.parse(localStorage.getItem('pageData') || '{}');
            let entries = localBackup.portfolio || [];
            if ((!entries || entries.length === 0)) {
                entries = JSON.parse(localStorage.getItem('portfolioBackup') || '[]');
            }
            renderPortfolio(entries || []);
        } catch (e) {
            if (portfolioGrid) {
                portfolioGrid.innerHTML = '<div class="portfolio-empty">Error al cargar datos.</div>';
            }
        }
    }
}

// Menú móvil reutilizando el layout existente
if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        navMenu.style.display = isMenuOpen ? 'flex' : 'none';
        navMenu.style.position = 'absolute';
        navMenu.style.top = '60px';
        navMenu.style.left = '0';
        navMenu.style.right = '0';
        navMenu.style.flexDirection = 'column';
        navMenu.style.background = 'var(--bg-white)';
        navMenu.style.padding = '2rem';
        navMenu.style.gap = '1rem';
        navMenu.style.boxShadow = 'var(--shadow-md)';
        navMenu.style.zIndex = '999';
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768 && isMenuOpen) {
                navMenu.style.display = 'none';
                isMenuOpen = false;
            }
        });
    });
}

loadPortfolio();

})();
