// ===== API CLIENT - Integrado Directamente =====

// Detectar si estamos en desarrollo o producción
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PROD_API_BASE_URL = 'https://ninamulti-back.onrender.com';

// Producción: usa siempre el backend deployado en Render
// Desarrollo: localhost
const API_BASE_URL = isDevelopment ? 'http://localhost:5001' : PROD_API_BASE_URL;

// Normalizar URLs de imágenes que quedaron apuntando a localhost
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

let authToken = localStorage.getItem('adminToken');

console.log(`🌐 Ambiente: ${isDevelopment ? 'Desarrollo' : 'Producción'}`);
console.log(`🔗 API Base URL: ${API_BASE_URL}`);

// Función auxiliar para peticiones
async function apiCall(endpoint, method = 'GET', data = null, requiresAuth = false) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (requiresAuth) {
        // Releer token por si cambió después del login
        if (!authToken) {
            authToken = localStorage.getItem('adminToken');
        }

        if (!authToken) {
            console.warn('⚠️ Sin token al hacer request autenticado');
            throw new Error('No autenticado');
        }

        options.headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 Enviando Authorization Bearer');
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`📡 Request: ${method} ${fullUrl}`);

    try {
        const response = await fetch(fullUrl, options);
        console.log(`📡 Response Status: ${response.status}`);

        if (response.status === 401) {
            if (requiresAuth) {
                localStorage.removeItem('adminToken');
                authToken = null;
            }
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Error HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Response:`, result);
        return result;
    } catch (error) {
        console.error(`❌ API Error en ${endpoint}:`, error.message);
        throw error;
    }
}

// Login
async function login(username, password) {
    try {
        const response = await apiCall('/api/auth/login', 'POST', { username, password });
        authToken = response.token;
        localStorage.setItem('adminToken', authToken);
        localStorage.setItem('adminUsername', username || '');
        return response;
    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
}

// Logout
async function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');
}

// Limpiar sesión al cerrar/recargar la pestaña para evitar cacheos no deseados
function clearAdminSession() {
    authToken = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminLoggedIn');
}

window.addEventListener('beforeunload', clearAdminSession);

// Verificar token
async function verifyToken() {
    try {
        return await apiCall('/api/auth/verify', 'GET', null, true);
    } catch (error) {
        return false;
    }
}

// Subir imagen de servicio
async function uploadServiceImage(file) {
    try {
        if (!authToken) {
            throw new Error('No autenticado');
        }

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${API_BASE_URL}/api/services/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al subir imagen');
        }

        return await response.json();
    } catch (error) {
        console.error('Error al subir imagen:', error);
        throw error;
    }
}

// Obtener imágenes
async function getServiceImages() {
    try {
        return await apiCall('/api/services/images', 'GET', null, true);
    } catch (error) {
        console.error('Error al obtener imágenes:', error);
        throw error;
    }
}

// Eliminar imagen
async function deleteServiceImage(filename) {
    try {
        return await apiCall(`/api/services/images/${filename}`, 'DELETE', null, true);
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        throw error;
    }
}

// Obtener datos de página
async function getPageData() {
    try {
        return await apiCall('/api/content/page-data', 'GET');
    } catch (error) {
        console.error('Error al obtener datos:', error);
        throw error;
    }
}

// Guardar datos de página
async function savePageData(data) {
    try {
        try {
            return await apiCall('/api/content/page-data', 'POST', data, true);
        } catch (error) {
            // Si falla con 401, limpiar token inválido y hacer login nuevamente
            if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                console.warn('⚠️ Token inválido en savePageData, limpiando...');
                localStorage.removeItem('adminToken');
                authToken = null;

                // Mostrar modal de login para que se autentique de nuevo
                showLoginModal();
                throw new Error('Necesitas iniciar sesión nuevamente para guardar cambios');
            }
            throw error;
        }
    } catch (error) {
        console.error('Error al guardar datos:', error);
        throw error;
    }
}

// Cargar imágenes disponibles del servidor
async function loadAvailableImages() {
    try {
        console.log('🔄 Cargando imágenes disponibles...');
        try {
            const response = await apiCall('/api/services/images', 'GET', null, true);
            const images = response.images || [];

            // Guardar las imágenes disponibles en una variable global para acceso rápido
            window.availableImages = images;

            console.log(`✅ ${images.length} imágenes disponibles en el servidor:`, images);
        } catch (error) {
            // Si falla con 401, limpiar token inválido
            if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                console.warn('⚠️ Token inválido en loadAvailableImages, limpiando...');
                localStorage.removeItem('adminToken');
                authToken = null;
            }
            window.availableImages = [];
            console.warn('No hay imágenes disponibles en el servidor:', error.message);
        }
    } catch (error) {
        console.error('❌ Error cargando imágenes disponibles:', error);
        window.availableImages = [];
    }
}

// Mostrar imágenes disponibles para seleccionar
async function showAvailableImagesForService(serviceIndex) {
    console.log(`🖼️ Mostrando imágenes disponibles para servicio ${serviceIndex}`);

    // Asegurarse de que las imágenes estén cargadas
    if (!window.availableImages) {
        console.log('Cargando imágenes primero...');
        await loadAvailableImages();
    }

    console.log('Imágenes disponibles:', window.availableImages);

    const container = document.getElementById(`available-images-${serviceIndex}`);

    if (!container) {
        console.error(`Contenedor available-images-${serviceIndex} no encontrado`);
        return;
    }

    if (!window.availableImages || window.availableImages.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-light);">No hay imágenes disponibles en el servidor</div>';
        console.warn('No hay imágenes disponibles para mostrar');
        return;
    }

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem;">';

    window.availableImages.forEach((img, index) => {
        const filename = img.filename || img.url?.split('/').pop() || 'imagen';
        console.log(`Procesando imagen ${index}:`, img);
        console.log(`URL de imagen: ${img.url}`);

        html += `
            <div style="cursor: pointer; text-align: center;" 
                 onclick="selectAvailableImage('${img.url}', ${serviceIndex})"
                 title="${filename}">
                <img src="${img.url}" 
                     alt="${filename}" 
                     style="max-width: 70px; max-height: 70px; border-radius: 4px; border: 2px solid transparent; transition: border 0.2s;"
                     onmouseover="this.style.border='2px solid var(--primary)'"
                     onmouseout="this.style.border='2px solid transparent'"
                     onerror="console.error('Error cargando imagen:', this.src)">
                <div style="font-size: 0.7rem; margin-top: 0.25rem; color: var(--text-light); word-break: break-word;">${filename.substring(0, 10)}...</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
    console.log('Contenedor de imágenes actualizado');
}

// Seleccionar una imagen disponible
function selectAvailableImage(imageUrl, serviceIndex) {
    console.log(`✅ Imagen seleccionada:`, imageUrl);

    // Guardar la URL en el archivo input (como indicador interno)
    const fileInput = document.querySelector(`.service-image-${serviceIndex}`);
    if (fileInput) {
        // Crear un atributo personalizado para guardar la URL seleccionada
        fileInput.dataset.selectedImageUrl = imageUrl;
        fileInput.value = ''; // Limpiar el input file para que no muestre ruta local
    }

    // Mostrar preview de la imagen seleccionada
    const serviceDiv = document.querySelector(`.service-edit`);
    const allServiceDivs = document.querySelectorAll('.service-edit');
    const serviceElement = Array.from(allServiceDivs).find((el, idx) => idx === serviceIndex);

    if (serviceElement) {
        // Buscar o crear un contenedor para la preview
        let previewContainer = serviceElement.querySelector('.selected-image-preview');
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.className = 'selected-image-preview';
            const imageSizeSelect = serviceElement.querySelector(`.service-image-size-${serviceIndex}`);
            if (imageSizeSelect) {
                imageSizeSelect.parentElement.parentElement.appendChild(previewContainer);
            }
        }

        const imageSize = serviceElement.querySelector(`.service-image-size-${serviceIndex}`)?.value || '200px';
        const isCircular = parseInt(imageSize) <= 150;
        const borderRadius = isCircular ? '50%' : '12px';

        previewContainer.innerHTML = `
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(102, 126, 234, 0.05); border-radius: 4px;">
                <strong style="color: var(--primary);">✓ Imagen seleccionada:</strong>
                <img src="${imageUrl}" alt="selected" style="max-width: ${imageSize}; max-height: ${imageSize}; margin: 0.5rem 0; border-radius: ${borderRadius}; display: block; object-fit: cover;">
                <button type="button" onclick="this.parentElement.remove()" class="delete-btn" style="margin-top: 0.5rem;">Cambiar imagen</button>
            </div>
        `;
    }
}

// Health check
async function checkServerHealth() {
    try {
        return await apiCall('/api/health', 'GET');
    } catch (error) {
        console.error('Servidor no disponible:', error);
        return null;
    }
}

// ===== Tema fijo (light) =====
const html = document.documentElement;
html.setAttribute('data-theme', 'light');
localStorage.setItem('theme', 'light');

// ===== Loading & UI Helpers =====
const loadingSpinner = document.getElementById('loadingSpinner');
const loadingText = document.getElementById('loadingText');

function showLoading(text = 'Cargando...') {
    loadingText.textContent = text;
    loadingSpinner.classList.add('active');
}

function hideLoading() {
    loadingSpinner.classList.remove('active');
}

// ===== Funciones de Compresión de Imágenes =====
async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calcular nuevas dimensiones manteniendo aspecto
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a blob
                canvas.toBlob(
                    (blob) => {
                        // Crear nuevo archivo
                        const compressedFile = new File(
                            [blob],
                            file.name,
                            { type: 'image/jpeg', lastModified: Date.now() }
                        );
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error('Error al cargar imagen'));
        };

        reader.onerror = () => reject(new Error('Error al leer archivo'));
    });
}

// ===== Admin Panel System =====
const adminBtn = document.querySelector('.admin-btn');
const loginModal = document.getElementById('loginModal');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');
const closeAdmin = document.getElementById('closeAdmin');
const logoutBtn = document.getElementById('logoutBtn');

// Contraseña predeterminada (se puede cambiar desde el panel)
const DEFAULT_PASSWORD = 'Tomas271217';

// Estado del carrusel de testimonios
const testimonialSliderState = {
    items: [],
    currentIndex: 0,
    timer: null
};

function createFallbackAvatar(initials = 'NM') {
    const div = document.createElement('div');
    div.className = 'testimonial-avatar-fallback';
    div.textContent = initials;
    return div;
}

function stopTestimonialAuto() {
    if (testimonialSliderState.timer) {
        clearInterval(testimonialSliderState.timer);
        testimonialSliderState.timer = null;
    }
}

function goToTestimonialSlide(index) {
    const slider = document.getElementById('testimonialsSlider');
    const dotsContainer = document.getElementById('testimonialDots');

    if (!slider || testimonialSliderState.items.length === 0) return;

    const slides = slider.querySelectorAll('.testimonial-slide');
    testimonialSliderState.currentIndex = (index + slides.length) % slides.length;

    slider.style.transform = `translateX(-${testimonialSliderState.currentIndex * 100}%)`;

    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === testimonialSliderState.currentIndex);
    });

    const dots = dotsContainer?.querySelectorAll('.slider-dot') || [];
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === testimonialSliderState.currentIndex);
    });
}

function startTestimonialAuto() {
    stopTestimonialAuto();
    if (testimonialSliderState.items.length <= 1) return;
    testimonialSliderState.timer = setInterval(() => {
        goToTestimonialSlide(testimonialSliderState.currentIndex + 1);
    }, 6500);
}

function renderTestimonialsSlider(testimonials = []) {
    const slider = document.getElementById('testimonialsSlider');
    const dotsContainer = document.getElementById('testimonialDots');
    const prevBtn = document.getElementById('testimonialPrev');
    const nextBtn = document.getElementById('testimonialNext');
    const sliderWrapper = document.querySelector('.testimonials-slider');

    if (!slider || !dotsContainer) return;

    stopTestimonialAuto();
    slider.innerHTML = '';
    dotsContainer.innerHTML = '';

    testimonialSliderState.items = (testimonials || []).filter(t => t && t.active !== false);
    testimonialSliderState.currentIndex = 0;

    if (testimonialSliderState.items.length === 0) {
        slider.innerHTML = '<div class="testimonial-slide empty">Aún no hay testimonios cargados. Agrega fotos desde el panel de admin.</div>';
        if (prevBtn) prevBtn.style.visibility = 'hidden';
        if (nextBtn) nextBtn.style.visibility = 'hidden';
        dotsContainer.style.display = 'none';
        return;
    }

    const hasMultiple = testimonialSliderState.items.length > 1;
    if (prevBtn) prevBtn.style.visibility = hasMultiple ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = hasMultiple ? 'visible' : 'hidden';
    dotsContainer.style.display = hasMultiple ? 'flex' : 'none';

    testimonialSliderState.items.forEach((testimonial, index) => {
        const normalizedImage = normalizeImageUrl(testimonial.image);
        const initials = 'NM';

        const slide = document.createElement('div');
        slide.className = 'testimonial-slide';
        slide.setAttribute('data-index', index);

        const imageMarkup = normalizedImage
            ? `<img src="${normalizedImage}" alt="Testimonio" class="testimonial-img">`
            : `<div class="testimonial-avatar-fallback">${initials}</div>`;

        slide.innerHTML = `
            <div class="testimonial-photo">
                ${imageMarkup}
            </div>
        `;
        slider.appendChild(slide);

        // Reemplazar por fallback si la imagen falla
        const imgEl = slide.querySelector('img');
        if (imgEl) {
            imgEl.addEventListener('error', () => {
                imgEl.replaceWith(createFallbackAvatar(initials));
            });
        }

        const dot = document.createElement('button');
        dot.className = `slider-dot ${index === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Ir al testimonio ${index + 1}`);
        dot.addEventListener('click', () => {
            goToTestimonialSlide(index);
            startTestimonialAuto();
        });
        dotsContainer.appendChild(dot);
    });

    prevBtn.onclick = () => {
        goToTestimonialSlide(testimonialSliderState.currentIndex - 1);
        startTestimonialAuto();
    };

    nextBtn.onclick = () => {
        goToTestimonialSlide(testimonialSliderState.currentIndex + 1);
        startTestimonialAuto();
    };

    if (sliderWrapper) {
        sliderWrapper.onmouseenter = stopTestimonialAuto;
        sliderWrapper.onmouseleave = startTestimonialAuto;
    }

    goToTestimonialSlide(0);
    startTestimonialAuto();
}

// Cargar datos al iniciar
async function loadPageData() {
    try {
        // Intentar cargar desde el servidor sin autenticación
        try {
            const data = await apiCall('/api/content/page-data', 'GET', null, false);
            console.log('📥 Datos cargados desde el servidor:', data);

            // Guardar en localStorage como respaldo
            localStorage.setItem('pageData', JSON.stringify(data));

            // Aplicar los datos
            applyPageData(data);
        } catch (error) {
            // Si falla con 401, limpiar token inválido e intentar de nuevo
            if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                console.warn('⚠️ Token inválido, limpiando...');
                localStorage.removeItem('adminToken');
                authToken = null;

                // Intentar una vez más sin token
                const data = await apiCall('/api/content/page-data', 'GET', null, false);
                console.log('📥 Datos cargados desde el servidor:', data);
                localStorage.setItem('pageData', JSON.stringify(data));
                applyPageData(data);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.warn('❌ Error cargando desde servidor, usando localStorage:', error.message);
        // Fallback a localStorage
        const savedData = localStorage.getItem('pageData');
        if (savedData) {
            const data = JSON.parse(savedData);
            applyPageData(data);
        }
    }
}

function applyPageData(data) {
    // Cargar Hero
    if (data.hero) {
        document.querySelector('.hero-title').textContent = data.hero.title || 'Nina Multipotencial';
        document.querySelector('.hero-subtitle').textContent = data.hero.subtitle || 'Creadora de Contenido UGC & Edición de Video Profesional';
        document.querySelector('.hero-description').textContent = data.hero.description || 'Transformo ideas en contenido visual impactante...';
    }

    // Cargar Acerca de
    if (data.about) {
        const aboutSection = document.querySelector('.about-content');
        if (aboutSection) {
            const paragraphs = aboutSection.querySelectorAll('p');
            if (paragraphs.length > 0) paragraphs[0].textContent = data.about.text1 || paragraphs[0].textContent;
            if (paragraphs.length > 1) paragraphs[1].textContent = data.about.text2 || paragraphs[1].textContent;

            if (data.about.features) {
                const featuresContainer = aboutSection.querySelector('.about-features');
                featuresContainer.innerHTML = '';
                data.about.features.forEach(feature => {
                    const featureDiv = document.createElement('div');
                    featureDiv.className = 'feature';
                    featureDiv.innerHTML = `<span class="feature-icon">✓</span><span>${feature}</span>`;
                    featuresContainer.appendChild(featureDiv);
                });
            }
        }
    }

    // Cargar Servicios
    if (data.services) {
        console.log('🔄 Cargando servicios:', data.services);
        const servicesGrid = document.querySelector('.services-grid');
        servicesGrid.innerHTML = '';
        data.services.forEach((service, index) => {
            console.log(`Servicio ${index}:`, service);
            console.log(`Tamaño de imagen: ${service.imageSize}`);

            if (service.active !== false) {
                const serviceDiv = document.createElement('div');
                serviceDiv.className = 'service-card';

                // Determinar el tamaño de la imagen basado en imageSize
                let iconSize = '200px'; // default mediano
                let isCircular = true;

                if (service.imageSize) {
                    // Si es un valor en px, usarlo directamente
                    if (service.imageSize.includes('px')) {
                        iconSize = service.imageSize;
                        // Para tamaños grandes, hacerlas cuadradas en lugar de circulares
                        isCircular = parseInt(service.imageSize) <= 150;
                    } else {
                        // Valores legacy como "pequeño", "mediano", "grande"
                        if (service.imageSize === 'pequeño') {
                            iconSize = '50px';
                            isCircular = true;
                        } else if (service.imageSize === 'grande') {
                            iconSize = '100px';
                            isCircular = true;
                        } else if (service.imageSize === 'mediano') {
                            iconSize = '70px';
                            isCircular = true;
                        }
                    }
                }

                console.log(`Tamaño calculado para icono: ${iconSize}, Circular: ${isCircular}`);

                const borderRadius = isCircular ? '50%' : '12px';
                const imageUrl = normalizeImageUrl(service.image);
                const iconContent = imageUrl
                    ? `<img src="${imageUrl}" alt="${service.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: ${borderRadius};" onerror="console.error('Error cargando imagen del servicio:', this.src)">`
                    : `<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
                serviceDiv.innerHTML = `
                    <div class="service-icon" style="width: ${iconSize}; height: ${iconSize}; border-radius: ${borderRadius};">
                        ${iconContent}
                    </div>
                    <h3>${service.title}</h3>
                    <p>${service.description}</p>
                    <div class="service-actions">
                        ${service.learnMoreLink ? `<a href="${service.learnMoreLink}" target="_blank" rel="noopener noreferrer" class="service-btn service-btn-secondary">
                            <span>Más información</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </a>` : ''}
                        ${service.purchaseLink ? `<a href="${service.purchaseLink}" target="_blank" rel="noopener noreferrer" class="service-btn service-btn-primary">
                            <span>Contratar ahora</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                        </a>` : ''}
                    </div>
                `;
                servicesGrid.appendChild(serviceDiv);
            }
        });
    }

    // Cargar Testimonios con carrusel
    renderTestimonialsSlider(data.testimonials || []);

    // Cargar Contacto
    if (data.contact) {
        const whatsappLink = document.querySelector('.cta-button');
        if (whatsappLink && data.contact.whatsapp) {
            whatsappLink.href = `https://wa.me/${data.contact.whatsapp}?text=Hola%20Nina,%20me%20interesa%20tus%20servicios%20de%20creación%20de%20contenido`;
        }

        // Actualizar links de redes sociales
        const socialLinks = document.querySelectorAll('.social-link');
        if (socialLinks.length >= 3) {
            if (data.contact.instagram) {
                socialLinks[0].href = data.contact.instagram;
                socialLinks[0].setAttribute('target', '_blank');
                socialLinks[0].setAttribute('rel', 'noopener noreferrer');
                socialLinks[0].onclick = (e) => {
                    e.preventDefault();
                    window.open(data.contact.instagram, '_blank', 'noopener,noreferrer');
                };
            }
            if (data.contact.tiktok) {
                socialLinks[1].href = data.contact.tiktok;
                socialLinks[1].setAttribute('target', '_blank');
                socialLinks[1].setAttribute('rel', 'noopener noreferrer');
                socialLinks[1].onclick = (e) => {
                    e.preventDefault();
                    window.open(data.contact.tiktok, '_blank', 'noopener,noreferrer');
                };
            }
            if (data.contact.linkedin) {
                socialLinks[2].href = data.contact.linkedin;
                socialLinks[2].setAttribute('target', '_blank');
                socialLinks[2].setAttribute('rel', 'noopener noreferrer');
                socialLinks[2].onclick = (e) => {
                    e.preventDefault();
                    window.open(data.contact.linkedin, '_blank', 'noopener,noreferrer');
                };
            }
        }
    }

    // Aplicar colores si están definidos
    if (data.colors) {
        applyColors(data.colors);
    }

    // Aplicar tipografía si está definida
    if (data.typography) {
        applyTypography(data.typography);
    }
}


// Mostrar modal de login
function showLoginModal() {
    loginModal.style.display = 'flex';
    adminPanel.style.display = 'none';
}

// Verificar login
adminBtn.addEventListener('click', () => {
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    if (isLoggedIn) {
        adminPanel.style.display = 'flex';
        loadAdminPanel();
    } else {
        showLoginModal();
    }
});

// Procesar login - Integración con backend
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = adminUsername.value.trim();
    const password = adminPassword.value;

    try {
        // Intentar login con backend
        const result = await login(username, password);
        localStorage.setItem('adminLoggedIn', 'true');
        loginModal.style.display = 'none';
        adminPanel.style.display = 'flex';
        adminPassword.value = '';
        adminUsername.value = '';
        loadAdminPanel();
    } catch (error) {
        // Si falla el backend, intentar con contraseña local
        const savedPassword = localStorage.getItem('adminPassword') || DEFAULT_PASSWORD;
        if (password === savedPassword) {
            localStorage.setItem('adminLoggedIn', 'true');
            loginModal.style.display = 'none';
            adminPanel.style.display = 'flex';
            adminPassword.value = '';
            adminUsername.value = '';
            loadAdminPanel();
        } else {
            alert('Contraseña incorrecta: ' + error.message);
            adminPassword.value = '';
        }
    }
});

// Cerrar admin panel
closeAdmin.addEventListener('click', () => {
    adminPanel.style.display = 'none';
});

logoutBtn.addEventListener('click', () => {
    localStorage.setItem('adminLoggedIn', 'false');
    adminPanel.style.display = 'none';
    loginModal.style.display = 'flex';
});

// Cerrar modal si se hace clic fuera
window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.style.display = 'none';
    }
    if (e.target === adminPanel) {
        adminPanel.style.display = 'none';
    }
});

// Cargar datos del panel admin
async function loadAdminPanel() {
    try {
        // Cargar datos desde el servidor
        const data = await apiCall('/api/content/page-data');
        console.log('📥 Datos del panel cargados desde el servidor:', data);

        // Aplicar datos al panel
        applyAdminPanelData(data);
    } catch (error) {
        console.warn('❌ Error cargando datos del panel desde servidor, usando localStorage:', error.message);
        // Fallback a localStorage
        const savedData = localStorage.getItem('pageData') || '{}';
        const data = JSON.parse(savedData);
        applyAdminPanelData(data);
    }
}

function applyAdminPanelData(data) {
    document.getElementById('heroTitle').value = data.hero?.title || 'Nina Multipotencial';
    document.getElementById('heroSubtitle').value = data.hero?.subtitle || 'Creadora de Contenido UGC & Edición de Video Profesional';
    document.getElementById('heroDescription').value = data.hero?.description || 'Transformo ideas en contenido visual impactante...';

    // About
    document.getElementById('aboutText1').value = data.about?.text1 || '';
    document.getElementById('aboutText2').value = data.about?.text2 || '';

    const featuresContainer = document.getElementById('featuresContainer');
    featuresContainer.innerHTML = '';
    (data.about?.features || []).forEach((feature, index) => {
        const featureDiv = document.createElement('div');
        featureDiv.className = 'feature-edit';
        featureDiv.innerHTML = `
            <input type="text" value="${feature}" placeholder="Característica" class="feature-input">
            <button type="button" onclick="this.parentElement.remove()" class="delete-btn">Eliminar</button>
        `;
        featuresContainer.appendChild(featureDiv);
    });

    // Cargar imágenes disponibles del backend
    loadAvailableImages();

    // Services
    const servicesContainer = document.getElementById('servicesContainer');
    servicesContainer.innerHTML = '';
    (data.services || []).forEach((service, index) => {
        const serviceDiv = document.createElement('div');
        serviceDiv.className = 'service-edit';
        const imageSize = service.imageSize || 'mediano'; // Tamaño por defecto
        const normalizedPreview = normalizeImageUrl(service.image);
        const imagePreview = normalizedPreview ? `<img src="${normalizedPreview}" alt="preview" style="max-width: ${imageSize}; max-height: ${imageSize}; margin: 0.5rem 0; border-radius: 8px; object-fit: cover;">` : '';
        serviceDiv.innerHTML = `
            <div class="form-group">
                <label>Título del Servicio</label>
                <input type="text" value="${service.title || ''}" class="service-title-${index}" placeholder="Título">
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea rows="3" class="service-desc-${index}" placeholder="Descripción">${service.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Imagen del Servicio</label>
                <div style="margin-bottom: 1rem;">
                    <details style="cursor: pointer;">
                        <summary style="padding: 0.5rem; background: var(--bg-light); border-radius: 4px; user-select: none;">
                            📁 Ver imágenes disponibles en el servidor
                        </summary>
                        <div class="available-images-${index}" id="available-images-${index}" style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-light); border-radius: 4px; max-height: 300px; overflow-y: auto;">
                            <div style="text-align: center; color: var(--text-light);">Cargando imágenes...</div>
                        </div>
                    </details>
                </div>
                <input type="file" class="service-image-${index}" accept="image/*" placeholder="O selecciona una imagen nueva">
                <div style="margin-top: 0.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">
                        Tamaño de la imagen:
                        <select class="service-image-size-${index}" style="margin-left: 0.5rem; padding: 0.35rem;">
                            <option value="80px" ${imageSize === '80px' ? 'selected' : ''}>Circular Pequeño (80px)</option>
                            <option value="120px" ${imageSize === '120px' ? 'selected' : ''}>Circular Mediano (120px)</option>
                            <option value="150px" ${imageSize === '150px' ? 'selected' : ''}>Circular Grande (150px)</option>
                            <option value="200px" ${imageSize === '200px' ? 'selected' : ''}>Cuadrado Mediano (200x200)</option>
                            <option value="250px" ${imageSize === '250px' ? 'selected' : ''}>Cuadrado Grande (250x250)</option>
                            <option value="300px" ${imageSize === '300px' ? 'selected' : ''}>Cuadrado Extra Grande (300x300)</option>
                        </select>
                    </label>
                </div>
                ${imagePreview}
            </div>
            <div class="form-group">
                <label>Link - Más Información</label>
                <input type="url" class="service-learn-more-${index}" placeholder="https://ejemplo.com/mas-info" value="${service.learnMoreLink || ''}">
            </div>
            <div class="form-group">
                <label>Link - Contratar/Comprar</label>
                <input type="url" class="service-purchase-${index}" placeholder="https://ejemplo.com/comprar" value="${service.purchaseLink || ''}">
            </div>
            <label>
                <input type="checkbox" ${service.active !== false ? 'checked' : ''} class="service-active-${index}"> Activo
            </label>
            <button type="button" onclick="this.parentElement.remove()" class="delete-btn">Eliminar Servicio</button>
            <hr>
        `;
        servicesContainer.appendChild(serviceDiv);

        // Agregar evento al details para cargar imágenes
        const detailsElement = serviceDiv.querySelector('details');
        if (detailsElement) {
            detailsElement.addEventListener('toggle', function () {
                if (this.open) {
                    showAvailableImagesForService(index);
                }
            });
        }
    });

    // Testimonials
    const testimonialsContainer = document.getElementById('testimonialsContainer');
    testimonialsContainer.innerHTML = '';
    (data.testimonials || []).forEach((testimonial, index) => {
        const normalizedImage = normalizeImageUrl(testimonial.image);
        const testimonialDiv = document.createElement('div');
        testimonialDiv.className = 'testimonial-edit';
        testimonialDiv.innerHTML = `
            <div class="form-group">
                <label>Foto del testimonio</label>
                <div class="testimonial-image-preview ${normalizedImage ? '' : 'empty'}">
                    ${normalizedImage ? `<img src="${normalizedImage}" alt="Foto">` : 'Sin foto cargada'}
                </div>
                <input type="file" accept="image/*" class="testimonial-image-${index}" data-existing-image="${normalizedImage || ''}">
                <p class="input-hint">Sube una imagen cuadrada; se guarda en el backend para cualquier dispositivo.</p>
            </div>
            <label>
                <input type="checkbox" ${testimonial.active !== false ? 'checked' : ''} class="testimonial-active-${index}"> Activo
            </label>
            <button type="button" onclick="this.parentElement.remove()" class="delete-btn">Eliminar Testimonio</button>
            <hr>
        `;
        testimonialsContainer.appendChild(testimonialDiv);

        const fileInput = testimonialDiv.querySelector(`.testimonial-image-${index}`);
        const preview = testimonialDiv.querySelector('.testimonial-image-preview');
        if (fileInput && preview) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                        preview.classList.remove('empty');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    });

    // Contact
    document.getElementById('whatsappNumber').value = data.contact?.whatsapp || '3512715524';
    document.getElementById('contactEmail').value = data.contact?.email || 'nina@multipotencial.com';
    document.getElementById('instagramLink').value = data.contact?.instagram || '';
    document.getElementById('tiktokLink').value = data.contact?.tiktok || '';
    document.getElementById('linkedinLink').value = data.contact?.linkedin || '';

    // Colors
    loadColorsIntoPanel();

    // Typography
    loadTypographyIntoPanel(data.typography || defaultTypography);

    // Logo
    loadLogoIntoPanel();
}

// Guardar Hero
function saveHeroContent() {
    const data = JSON.parse(localStorage.getItem('pageData') || '{}');
    data.hero = {
        title: document.getElementById('heroTitle').value,
        subtitle: document.getElementById('heroSubtitle').value,
        description: document.getElementById('heroDescription').value
    };
    localStorage.setItem('pageData', JSON.stringify(data));
    loadPageData();
    alert('Cambios guardados en la sección Hero');
}

// Guardar About
function saveAboutContent() {
    const data = JSON.parse(localStorage.getItem('pageData') || '{}');
    const features = [];
    document.querySelectorAll('.feature-edit .feature-input').forEach(input => {
        if (input.value.trim()) features.push(input.value);
    });

    data.about = {
        text1: document.getElementById('aboutText1').value,
        text2: document.getElementById('aboutText2').value,
        features: features
    };
    localStorage.setItem('pageData', JSON.stringify(data));
    loadPageData();
    alert('Cambios guardados en Acerca de Mí');
}

// Agregar nueva característica
function addFeature() {
    const container = document.getElementById('featuresContainer');
    const featureDiv = document.createElement('div');
    featureDiv.className = 'feature-edit';
    featureDiv.innerHTML = `
        <input type="text" placeholder="Nueva característica" class="feature-input">
        <button type="button" onclick="this.parentElement.remove()" class="delete-btn">Eliminar</button>
    `;
    container.appendChild(featureDiv);
}

// Guardar Servicios - Con Loading, Preview y Compresión
async function saveServices() {
    const data = JSON.parse(localStorage.getItem('pageData') || '{}');
    const services = [];
    const serviceElements = document.querySelectorAll('.service-edit');

    showLoading('Guardando servicios...');

    if (serviceElements.length === 0) {
        data.services = services;
        localStorage.setItem('pageData', JSON.stringify(data));
        await savePageData(data).catch(e => console.error('Error al sincronizar:', e));
        loadPageData();
        hideLoading();
        alert('Servicios guardados');
        return;
    }

    // Usar for loop para mantener el orden y esperar cada iteración
    for (let index = 0; index < serviceElements.length; index++) {
        const el = serviceElements[index];
        const imageInput = el.querySelector(`.service-image-${index}`);
        let imageUrl = null;

        // Primero verificar si se seleccionó una imagen disponible del servidor
        const selectedImageUrl = imageInput?.dataset?.selectedImageUrl;

        if (selectedImageUrl) {
            // Usar la imagen seleccionada del servidor
            imageUrl = selectedImageUrl;
            console.log(`✅ Usando imagen del servidor: ${selectedImageUrl}`);
        } else if (imageInput && imageInput.files && imageInput.files[0]) {
            // Si hay archivo nuevo, procesarlo
            try {
                showLoading(`Comprimiendo imagen (${index + 1}/${serviceElements.length})...`);

                // Comprimir imagen
                let compressedFile = await compressImage(imageInput.files[0]);

                showLoading(`Subiendo imagen (${index + 1}/${serviceElements.length})...`);

                // Subir al backend
                const result = await uploadServiceImage(compressedFile);
                imageUrl = result.url || result.imageUrl;
                console.log(`✅ Imagen ${index + 1} guardada:`, imageUrl);
            } catch (error) {
                console.error(`Error al procesar imagen ${index + 1}:`, error);
                // Si la imagen ya tiene una URL previa, mantenerla
                const existingService = data.services?.[index];
                imageUrl = existingService?.image || null;
            }
        } else {
            // Si no hay archivo nuevo, mantener la imagen anterior si existe
            const existingService = data.services?.[index];
            imageUrl = existingService?.image || null;
        }

        const normalizedImage = normalizeImageUrl(imageUrl);

        services.push({
            title: el.querySelector(`.service-title-${index}`).value,
            description: el.querySelector(`.service-desc-${index}`).value,
            image: normalizedImage,
            imageSize: el.querySelector(`.service-image-size-${index}`)?.value || '200px',
            learnMoreLink: el.querySelector(`.service-learn-more-${index}`)?.value || '',
            purchaseLink: el.querySelector(`.service-purchase-${index}`)?.value || '',
            active: el.querySelector(`.service-active-${index}`).checked
        });
    }

    showLoading('Sincronizando con base de datos...');
    data.services = services;
    localStorage.setItem('pageData', JSON.stringify(data));
    await savePageData(data).catch(e => console.error('Error al sincronizar:', e));
    loadPageData();
    hideLoading();
    alert('✓ Servicios guardados correctamente');
}

// Agregar nuevo servicio
function addNewService() {
    const container = document.getElementById('servicesContainer');
    const newIndex = container.children.length;
    const serviceDiv = document.createElement('div');
    serviceDiv.className = 'service-edit';
    serviceDiv.innerHTML = `
        <div class="form-group">
            <label>Título del Servicio</label>
            <input type="text" class="service-title-${newIndex}" placeholder="Título">
        </div>
        <div class="form-group">
            <label>Descripción</label>
            <textarea rows="3" class="service-desc-${newIndex}" placeholder="Descripción"></textarea>
        </div>
        <div class="form-group">
            <label>Imagen del Servicio</label>
            <div class="image-preview-container" id="preview-container-${newIndex}">
                <div style="color: var(--text-light); font-size: 0.9rem;">
                    📁 Haz clic o arrastra una imagen aquí
                </div>
            </div>
            <input type="file" 
                   class="service-image-${newIndex}" 
                   accept="image/*" 
                   id="service-image-input-${newIndex}"
                   placeholder="Selecciona una imagen"
                   style="display: none;">
            <div style="margin-top: 0.5rem;">
                <label style="display: block; margin-bottom: 0.5rem;">
                    Tamaño de la imagen:
                    <select class="service-image-size-${newIndex}" style="margin-left: 0.5rem; padding: 0.35rem;">
                        <option value="80px">Circular Pequeño (80px)</option>
                        <option value="120px">Circular Mediano (120px)</option>
                        <option value="150px">Circular Grande (150px)</option>
                        <option value="200px" selected>Cuadrado Mediano (200x200)</option>
                        <option value="250px">Cuadrado Grande (250x250)</option>
                        <option value="300px">Cuadrado Extra Grande (300x300)</option>
                    </select>
                </label>
            </div>
            <div class="upload-progress" id="progress-${newIndex}">
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill-${newIndex}"></div>
                </div>
                <div class="progress-text" id="progress-text-${newIndex}">0%</div>
            </div>
            <div class="preview-info" id="preview-info-${newIndex}"></div>
        </div>
        <div class="form-group">
            <label>Link - Más Información</label>
            <input type="url" class="service-learn-more-${newIndex}" placeholder="https://ejemplo.com/mas-info">
        </div>
        <div class="form-group">
            <label>Link - Contratar/Comprar</label>
            <input type="url" class="service-purchase-${newIndex}" placeholder="https://ejemplo.com/comprar">
        </div>
        <label>
            <input type="checkbox" checked class="service-active-${newIndex}"> Activo
        </label>
        <button type="button" onclick="this.parentElement.remove()" class="delete-btn">Eliminar Servicio</button>
        <hr>
    `;
    container.appendChild(serviceDiv);

    // Agregar event listeners para preview
    const fileInput = serviceDiv.querySelector(`#service-image-input-${newIndex}`);
    const previewContainer = serviceDiv.querySelector(`#preview-container-${newIndex}`);
    const previewInfo = serviceDiv.querySelector(`#preview-info-${newIndex}`);

    // Click para seleccionar archivo
    previewContainer.addEventListener('click', () => fileInput.click());

    // Drag and drop
    previewContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        previewContainer.style.background = 'rgba(102, 126, 234, 0.1)';
    });

    previewContainer.addEventListener('dragleave', () => {
        previewContainer.style.background = '';
    });

    previewContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        previewContainer.style.background = '';
        if (e.dataTransfer.files[0]) {
            fileInput.files = e.dataTransfer.files;
            showImagePreview(fileInput, newIndex);
        }
    });

    // Event listener para cambiar tamaño en tiempo real
    const imageSizeSelect = serviceDiv.querySelector(`.service-image-size-${newIndex}`);
    if (imageSizeSelect) {
        imageSizeSelect.addEventListener('change', () => {
            const previewImg = previewContainer.querySelector('img');
            if (previewImg) {
                const newSize = imageSizeSelect.value;
                const isCircular = parseInt(newSize) <= 150;
                const borderRadius = isCircular ? '50%' : '12px';

                previewImg.style.maxWidth = newSize;
                previewImg.style.maxHeight = newSize;
                previewImg.style.objectFit = 'cover';
                previewImg.style.borderRadius = borderRadius;
            }
        });
    }

    // Cambio de archivo
    fileInput.addEventListener('change', () => showImagePreview(fileInput, newIndex));
}

// Mostrar preview de imagen
function showImagePreview(fileInput, index) {
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewContainer = document.getElementById(`preview-container-${index}`);
            const previewInfo = document.getElementById(`preview-info-${index}`);
            const imageSizeSelect = document.querySelector(`.service-image-size-${index}`);
            const imageSize = imageSizeSelect?.value || '200px';
            const isCircular = parseInt(imageSize) <= 150;
            const borderRadius = isCircular ? '50%' : '12px';
            const fileSize = (file.size / 1024).toFixed(2);

            previewContainer.innerHTML = `
                <img src="${e.target.result}" class="preview-image" alt="Preview" style="max-width: ${imageSize}; max-height: ${imageSize}; object-fit: cover; border-radius: ${borderRadius};">
            `;
            previewContainer.classList.add('has-image');
            previewInfo.innerHTML = `
                <strong>${file.name}</strong><br>
                Tamaño: ${fileSize} KB<br>
                <span style="font-size: 0.8rem; color: var(--primary);">✓ Listo para guardar</span>
            `;
        };
        reader.readAsDataURL(file);
    }
}

// Guardar Testimonios (solo imagen)
async function saveTestimonials() {
    const data = JSON.parse(localStorage.getItem('pageData') || '{}');
    const testimonials = [];
    const testimonialElements = document.querySelectorAll('.testimonial-edit');

    if (testimonialElements.length === 0) {
        data.testimonials = [];
        localStorage.setItem('pageData', JSON.stringify(data));
        await savePageData(data).catch(e => console.error('Error al sincronizar testimonios vacíos:', e));
        loadPageData();
        alert('Testimonios guardados');
        return;
    }

    showLoading('Guardando testimonios...');

    for (let index = 0; index < testimonialElements.length; index++) {
        const el = testimonialElements[index];
        const fileInput = el.querySelector(`.testimonial-image-${index}`);
        let imageUrl = fileInput?.dataset?.existingImage || data.testimonials?.[index]?.image || null;

        if (fileInput && fileInput.files && fileInput.files[0]) {
            try {
                showLoading(`Subiendo foto (${index + 1}/${testimonialElements.length})...`);
                const compressedFile = await compressImage(fileInput.files[0], 1200, 1200, 0.82);
                const uploadResult = await uploadServiceImage(compressedFile);
                imageUrl = uploadResult.url || uploadResult.imageUrl || imageUrl;
                if (fileInput) {
                    fileInput.dataset.existingImage = imageUrl || '';
                }
            } catch (error) {
                console.error('Error subiendo foto del testimonio:', error);
            }
        }

        testimonials.push({
            image: normalizeImageUrl(imageUrl),
            active: el.querySelector(`.testimonial-active-${index}`).checked
        });
    }

    data.testimonials = testimonials;
    localStorage.setItem('pageData', JSON.stringify(data));

    try {
        showLoading('Sincronizando con el servidor...');
        await savePageData(data);
        alert('✓ Testimonios guardados');
    } catch (error) {
        console.error('Error al sincronizar testimonios con backend:', error);
        alert('Testimonios guardados localmente, pero falló la sincronización: ' + error.message);
    } finally {
        hideLoading();
        loadPageData();
    }
}

// Agregar testimonio
function addTestimonial() {
    const container = document.getElementById('testimonialsContainer');
    const newIndex = container.children.length;
    const testimonialDiv = document.createElement('div');
    testimonialDiv.className = 'testimonial-edit';
    testimonialDiv.innerHTML = `
        <div class="form-group">
            <label>Foto del testimonio</label>
            <div class="testimonial-image-preview empty">Sin foto cargada</div>
            <input type="file" accept="image/*" class="testimonial-image-${newIndex}" data-existing-image="">
            <p class="input-hint">Sube una imagen cuadrada; se guarda en el backend para cualquier dispositivo.</p>
        </div>
        <label>
            <input type="checkbox" checked class="testimonial-active-${newIndex}"> Activo
        </label>
        <button type="button" onclick="this.parentElement.remove()" class="delete-btn">Eliminar Testimonio</button>
        <hr>
    `;
    container.appendChild(testimonialDiv);

    const fileInput = testimonialDiv.querySelector(`.testimonial-image-${newIndex}`);
    const preview = testimonialDiv.querySelector('.testimonial-image-preview');
    if (fileInput && preview) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                    preview.classList.remove('empty');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Guardar Contacto
function saveContactContent() {
    const data = JSON.parse(localStorage.getItem('pageData') || '{}');

    data.contact = {
        whatsapp: document.getElementById('whatsappNumber').value,
        email: document.getElementById('contactEmail').value,
        instagram: document.getElementById('instagramLink').value,
        tiktok: document.getElementById('tiktokLink').value,
        linkedin: document.getElementById('linkedinLink').value
    };

    localStorage.setItem('pageData', JSON.stringify(data));
    alert('Contacto guardado');
    loadPageData();
}

// Tabs del admin panel
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');
    });
});

// ===== Mobile Menu Toggle =====
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
let isMenuOpen = false;

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

// Cerrar menú al hacer clic en un enlace (solo en mobile)
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768 && isMenuOpen) {
            navMenu.style.display = 'none';
            isMenuOpen = false;
        }
    });
});

// ===== Smooth Scroll Navigation =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// ===== Navbar Shadow on Scroll =====
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
        navbar.style.boxShadow = 'var(--shadow-md)';
    } else {
        navbar.style.boxShadow = 'var(--shadow-sm)';
    }
});

// ===== Intersection Observer para Animaciones =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observar elementos de tarjetas
document.querySelectorAll('.service-card, .portfolio-item, .testimonial-card').forEach(el => {
    observer.observe(el);
});

// ===== Form Handling =====
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        const button = contactForm.querySelector('.submit-button');
        const originalText = button.textContent;
        button.textContent = 'Enviando...';
        button.disabled = true;

        setTimeout(() => {
            button.textContent = '¡Mensaje enviado!';
            button.style.background = 'linear-gradient(135deg, #25d366, #20c856)';
            contactForm.reset();

            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
                button.disabled = false;
            }, 3000);
        }, 800);
    });
}

// ===== Animación de números (contador) =====
const animateCounter = (element, target, duration = 2000) => {
    let current = 0;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
};

// ===== Lazy Loading =====
if ('IntersectionObserver' in window) {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// ===== Efectos de desplazamiento (Parallax) =====
window.addEventListener('scroll', () => {
    const shapes = document.querySelectorAll('.shape');
    const scrollY = window.scrollY;

    shapes.forEach((shape, index) => {
        const speed = 0.5 + (index * 0.1);
        shape.style.transform = `translateY(${scrollY * speed}px)`;
    });
});

// ===== Agregar animación a enlaces del navbar =====
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('mouseenter', function () {
        this.style.color = 'var(--primary)';
    });
    link.addEventListener('mouseleave', function () {
        this.style.color = 'var(--text-dark)';
    });
});

// ===== Validación de Email en tiempo real =====
const emailInput = document.querySelector('input[type="email"]');
if (emailInput) {
    emailInput.addEventListener('blur', function () {
        const email = this.value;
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!isValid && email !== '') {
            this.style.borderColor = '#ff6b6b';
            this.style.boxShadow = '0 0 0 3px rgba(255, 107, 107, 0.1)';
        } else {
            this.style.borderColor = 'var(--border-color)';
            this.style.boxShadow = '';
        }
    });
}

// ===== Color Management =====
const defaultColors = {
    primary: '#667eea',
    primaryDark: '#764ba2',
    accent: '#25d366',
    textDark: '#1a1a1a',
    textLight: '#666',
    bgLight: '#f5f7fa',
    bgWhite: '#ffffff',
    bgCard: '#ffffff',
    borderColor: '#e0e0e0',
    inputBg: '#ffffff',
    inputBorder: '#ddd',
    navbarBg: 'rgba(255,255,255,0.95)',
    navbarText: '#1a1a1a'
};

async function loadColors() {
    try {
        // Intentar cargar desde el servidor sin autenticación
        try {
            const data = await apiCall('/api/content/page-data', 'GET', null, false);
            if (data.colors) {
                applyColors(data.colors);
                // Guardar en localStorage como respaldo
                localStorage.setItem('customColors', JSON.stringify(data.colors));
            } else {
                // Usar colores por defecto
                applyColors(defaultColors);
            }
        } catch (error) {
            // Si falla con 401, limpiar token inválido e intentar de nuevo
            if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                console.warn('⚠️ Token inválido en loadColors, limpiando...');
                localStorage.removeItem('adminToken');
                authToken = null;

                // Intentar una vez más sin token
                const data = await apiCall('/api/content/page-data', 'GET', null, false);
                if (data.colors) {
                    applyColors(data.colors);
                    localStorage.setItem('customColors', JSON.stringify(data.colors));
                } else {
                    applyColors(defaultColors);
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.warn('Error cargando colores desde servidor, usando localStorage:', error.message);
        // Fallback a localStorage
        const savedColors = localStorage.getItem('customColors');
        if (savedColors) {
            const colors = JSON.parse(savedColors);
            applyColors(colors);
        } else {
            applyColors(defaultColors);
        }
    }
}

function applyColors(colors) {
    const root = document.documentElement;
    root.style.setProperty('--primary', colors.primary || defaultColors.primary);
    root.style.setProperty('--primary-dark', colors.primaryDark || defaultColors.primaryDark);
    root.style.setProperty('--accent', colors.accent || defaultColors.accent);
    root.style.setProperty('--text-dark', colors.textDark || defaultColors.textDark);
    root.style.setProperty('--text-light', colors.textLight || defaultColors.textLight);
    root.style.setProperty('--bg-light', colors.bgLight || defaultColors.bgLight);
    root.style.setProperty('--bg-white', colors.bgWhite || defaultColors.bgWhite);
    root.style.setProperty('--bg-card', colors.bgCard || defaultColors.bgCard);
    root.style.setProperty('--border-color', colors.borderColor || defaultColors.borderColor);
    root.style.setProperty('--input-bg', colors.inputBg || colors.bgCard || defaultColors.inputBg);
    root.style.setProperty('--input-border', colors.inputBorder || colors.borderColor || defaultColors.inputBorder);
    root.style.setProperty('--navbar-bg', colors.navbarBg || defaultColors.navbarBg);
    root.style.setProperty('--navbar-text', colors.navbarText || defaultColors.navbarText);
}

function loadColorsIntoPanel() {
    const savedColors = localStorage.getItem('customColors');
    const colors = savedColors ? JSON.parse(savedColors) : defaultColors;

    document.getElementById('primaryColor').value = colors.primary || defaultColors.primary;
    document.getElementById('primaryColorHex').value = colors.primary || defaultColors.primary;

    document.getElementById('primaryDarkColor').value = colors.primaryDark || defaultColors.primaryDark;
    document.getElementById('primaryDarkColorHex').value = colors.primaryDark || defaultColors.primaryDark;

    document.getElementById('accentColor').value = colors.accent || defaultColors.accent;
    document.getElementById('accentColorHex').value = colors.accent || defaultColors.accent;

    document.getElementById('textDarkColor').value = colors.textDark || defaultColors.textDark;
    document.getElementById('textDarkColorHex').value = colors.textDark || defaultColors.textDark;

    document.getElementById('textLightColor').value = colors.textLight || defaultColors.textLight;
    document.getElementById('textLightColorHex').value = colors.textLight || defaultColors.textLight;

    document.getElementById('bgLightColor').value = colors.bgLight || defaultColors.bgLight;
    document.getElementById('bgLightColorHex').value = colors.bgLight || defaultColors.bgLight;

    document.getElementById('bgWhiteColor').value = colors.bgWhite || defaultColors.bgWhite;
    document.getElementById('bgWhiteColorHex').value = colors.bgWhite || defaultColors.bgWhite;

    document.getElementById('bgCardColor').value = colors.bgCard || defaultColors.bgCard;
    document.getElementById('bgCardColorHex').value = colors.bgCard || defaultColors.bgCard;

    document.getElementById('borderColor').value = colors.borderColor || defaultColors.borderColor;
    document.getElementById('borderColorHex').value = colors.borderColor || defaultColors.borderColor;

    document.getElementById('navbarBgColor').value = colors.navbarBg || defaultColors.navbarBg;
    document.getElementById('navbarBgColorHex').value = colors.navbarBg || defaultColors.navbarBg;

    document.getElementById('navbarTextColor').value = colors.navbarText || defaultColors.navbarText;
    document.getElementById('navbarTextColorHex').value = colors.navbarText || defaultColors.navbarText;

    // Vincular cambios en tiempo real
    linkColorInputs('primaryColor', 'primaryColorHex');
    linkColorInputs('primaryDarkColor', 'primaryDarkColorHex');
    linkColorInputs('accentColor', 'accentColorHex');
    linkColorInputs('textDarkColor', 'textDarkColorHex');
    linkColorInputs('textLightColor', 'textLightColorHex');
    linkColorInputs('bgLightColor', 'bgLightColorHex');
    linkColorInputs('bgWhiteColor', 'bgWhiteColorHex');
    linkColorInputs('bgCardColor', 'bgCardColorHex');
    linkColorInputs('borderColor', 'borderColorHex');
    linkColorInputs('navbarBgColor', 'navbarBgColorHex');
    linkColorInputs('navbarTextColor', 'navbarTextColorHex');
}

function linkColorInputs(colorPickerId, hexInputId) {
    const colorPicker = document.getElementById(colorPickerId);
    const hexInput = document.getElementById(hexInputId);

    if (colorPicker && hexInput) {
        colorPicker.addEventListener('input', () => {
            hexInput.value = colorPicker.value;
        });

        hexInput.addEventListener('input', () => {
            if (/^#[0-9A-F]{6}$/i.test(hexInput.value)) {
                colorPicker.value = hexInput.value;
            }
        });
    }
}

async function saveColors() {
    const colors = {
        primary: document.getElementById('primaryColor').value,
        primaryDark: document.getElementById('primaryDarkColor').value,
        accent: document.getElementById('accentColor').value,
        textDark: document.getElementById('textDarkColor').value,
        textLight: document.getElementById('textLightColor').value,
        bgLight: document.getElementById('bgLightColor').value,
        bgWhite: document.getElementById('bgWhiteColor').value,
        bgCard: document.getElementById('bgCardColor').value,
        borderColor: document.getElementById('borderColor').value,
        inputBg: document.getElementById('bgCardColor').value,
        inputBorder: document.getElementById('borderColor').value,
        navbarBg: document.getElementById('navbarBgColor').value,
        navbarText: document.getElementById('navbarTextColor').value
    };

    try {
        try {
            // Obtener datos actuales (lectura pública)
            const currentData = await apiCall('/api/content/page-data');
            currentData.colors = colors;

            // Guardar en servidor (requiere auth)
            await apiCall('/api/content/page-data', 'POST', currentData, true);

            // También guardar en localStorage como respaldo
            localStorage.setItem('customColors', JSON.stringify(colors));
            applyColors(colors);
            alert('Colores guardados exitosamente');
        } catch (error) {
            // Si falla con 401, limpiar token
            if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                localStorage.removeItem('adminToken');
                authToken = null;
                showLoginModal();
                alert('Sesión expirada. Por favor, inicia sesión nuevamente para guardar cambios.');
                throw error;
            }
            throw error;
        }
    } catch (error) {
        console.warn('Error guardando colores en servidor, guardando localmente:', error.message);
        localStorage.setItem('customColors', JSON.stringify(colors));
        applyColors(colors);
        alert('Colores guardados localmente (sin conexión al servidor)');
    }
}

function resetColors() {
    if (confirm('¿Estás seguro de que deseas restaurar los colores por defecto?')) {
        localStorage.removeItem('customColors');
        applyColors(defaultColors);
        loadColorsIntoPanel();
        alert('Colores restaurados');
    }
}

// ===== Logo Management =====
function loadLogo() {
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
        applyLogo(savedLogo);
    }
}

function applyLogo(logoData) {
    const navLogo = document.getElementById('navLogo');
    if (logoData) {
        navLogo.innerHTML = `<img src="${logoData}" alt="Logo" style="max-height: 40px; width: auto;">`;
    }
}

function loadLogoIntoPanel() {
    const savedLogo = localStorage.getItem('customLogo');
    const preview = document.getElementById('logoPreview');

    if (savedLogo) {
        preview.innerHTML = `<img src="${savedLogo}" alt="Logo preview">`;
    } else {
        preview.innerHTML = '<p style="color: var(--text-light);">Sin logo personalizado</p>';
    }

    // Mostrar preview al seleccionar archivo
    const logoInput = document.getElementById('logoInput');
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    preview.innerHTML = `<img src="${event.target.result}" alt="Logo preview">`;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
}

function saveLogo() {
    const logoInput = document.getElementById('logoInput');
    if (logoInput && logoInput.files && logoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoData = e.target.result;
            localStorage.setItem('customLogo', logoData);
            applyLogo(logoData);
            alert('Logo guardado exitosamente');
        };
        reader.readAsDataURL(logoInput.files[0]);
    } else {
        alert('Por favor selecciona una imagen para el logo');
    }
}

function resetLogo() {
    if (confirm('¿Estás seguro de que deseas restaurar el logo predeterminado?')) {
        localStorage.removeItem('customLogo');
        const navLogo = document.getElementById('navLogo');
        navLogo.textContent = 'Nina';
        loadLogoIntoPanel();
        alert('Logo restaurado');
    }
}

// ===== Typography Functions =====
const defaultTypography = {
    primaryFont: "'Poppins', sans-serif",
    h1Size: '48px',
    h2Size: '32px',
    bodySize: '16px',
    fontWeight: '400',
    lineHeight: '1.6'
};

function loadTypographyIntoPanel(typography) {
    document.getElementById('primaryFont').value = typography.primaryFont || defaultTypography.primaryFont;
    document.getElementById('h1Size').value = parseInt(typography.h1Size) || 48;
    document.getElementById('h2Size').value = parseInt(typography.h2Size) || 32;
    document.getElementById('bodySize').value = parseInt(typography.bodySize) || 16;
    document.getElementById('fontWeight').value = typography.fontWeight || defaultTypography.fontWeight;
    document.getElementById('lineHeight').value = parseFloat(typography.lineHeight) || 1.6;

    // Cargar fuente personalizada si existe
    if (typography.customFontName) {
        document.getElementById('customFontName').value = typography.customFontName;
    }
    if (typography.googleFontsUrl) {
        document.getElementById('googleFontsUrl').value = typography.googleFontsUrl;
    }

    // Actualizar valores mostrados
    updateTypographyValues();

    // Mostrar/ocultar campos de fuente personalizada
    toggleCustomFontFields();

    // Aplicar tipografía actual
    applyTypography(typography);
}

function updateTypographyValues() {
    document.getElementById('h1SizeValue').textContent = document.getElementById('h1Size').value + 'px';
    document.getElementById('h2SizeValue').textContent = document.getElementById('h2Size').value + 'px';
    document.getElementById('bodySizeValue').textContent = document.getElementById('bodySize').value + 'px';
    document.getElementById('lineHeightValue').textContent = document.getElementById('lineHeight').value;
}

async function saveTypography() {
    const primaryFontSelect = document.getElementById('primaryFont');
    const selectedFont = primaryFontSelect.value;

    let typography = {
        primaryFont: selectedFont,
        h1Size: document.getElementById('h1Size').value + 'px',
        h2Size: document.getElementById('h2Size').value + 'px',
        bodySize: document.getElementById('bodySize').value + 'px',
        fontWeight: document.getElementById('fontWeight').value,
        lineHeight: document.getElementById('lineHeight').value
    };

    // Si es fuente personalizada, agregar información adicional
    if (selectedFont === 'custom') {
        const customFontName = document.getElementById('customFontName').value.trim();
        let googleFontsUrl = document.getElementById('googleFontsUrl').value.trim();

        if (customFontName) {
            typography.customFontName = customFontName;
            typography.primaryFont = `'${customFontName}', sans-serif`;

            // Si no hay URL pero sí nombre, generar URL automáticamente
            if (!googleFontsUrl) {
                googleFontsUrl = generateGoogleFontsUrl(customFontName);
                document.getElementById('googleFontsUrl').value = googleFontsUrl;
            }
        }

        if (googleFontsUrl) {
            typography.googleFontsUrl = googleFontsUrl;
            // Cargar la fuente de Google Fonts dinámicamente
            loadGoogleFont(googleFontsUrl);
        }
    }

    try {
        try {
            // Obtener datos actuales (lectura pública)
            const currentData = await apiCall('/api/content/page-data');
            currentData.typography = typography;

            // Guardar en servidor (requiere auth)
            await apiCall('/api/content/page-data', 'POST', currentData, true);

            // También guardar en localStorage como respaldo
            localStorage.setItem('customTypography', JSON.stringify(typography));
            applyTypography(typography);
            alert('Estilos de letra guardados correctamente');
        } catch (error) {
            // Si falla con 401, limpiar token
            if (error.message.includes('401') || error.message.includes('Sesión expirada')) {
                localStorage.removeItem('adminToken');
                authToken = null;
                showLoginModal();
                alert('Sesión expirada. Por favor, inicia sesión nuevamente para guardar cambios.');
                throw error;
            }
            throw error;
        }
    } catch (error) {
        console.warn('Error guardando tipografía en servidor, guardando localmente:', error.message);
        localStorage.setItem('customTypography', JSON.stringify(typography));
        applyTypography(typography);
        alert('Estilos guardados localmente (sin conexión al servidor)');
    }
}

function applyTypography(typography) {
    const root = document.documentElement;

    root.style.setProperty('--primary-font', typography.primaryFont);
    root.style.setProperty('--h1-size', typography.h1Size);
    root.style.setProperty('--h2-size', typography.h2Size);
    root.style.setProperty('--body-size', typography.bodySize);
    root.style.setProperty('--font-weight', typography.fontWeight);
    root.style.setProperty('--line-height', typography.lineHeight);

    // Si hay una URL de Google Fonts, cargarla
    if (typography.googleFontsUrl) {
        loadGoogleFont(typography.googleFontsUrl);
    }
}

function resetTypography() {
    if (confirm('¿Estás seguro de que deseas restaurar los estilos de letra por defecto?')) {
        localStorage.removeItem('customTypography');
        loadTypographyIntoPanel();
        applyTypography(defaultTypography);
        alert('Estilos de letra restaurados');
    }
}

async function loadTypography() {
    try {
        // Intentar cargar desde el servidor
        const data = await apiCall('/api/content/page-data');
        const typography = data.typography || defaultTypography;

        // Cargar fuente de Google Fonts si existe
        if (typography.googleFontsUrl) {
            loadGoogleFont(typography.googleFontsUrl);
        }

        applyTypography(typography);
        // Guardar en localStorage como respaldo
        localStorage.setItem('customTypography', JSON.stringify(typography));
    } catch (error) {
        console.warn('Error cargando tipografía desde servidor, usando localStorage:', error.message);
        // Fallback a localStorage
        const savedTypography = localStorage.getItem('customTypography');
        const typography = savedTypography ? JSON.parse(savedTypography) : defaultTypography;

        if (typography.googleFontsUrl) {
            loadGoogleFont(typography.googleFontsUrl);
        }

        applyTypography(typography);
    }
}

function toggleCustomFontFields() {
    const primaryFontSelect = document.getElementById('primaryFont');
    const customFontGroup = document.getElementById('customFontGroup');
    const googleFontsUrlGroup = document.getElementById('googleFontsUrlGroup');

    if (primaryFontSelect.value === 'custom') {
        customFontGroup.style.display = 'block';
        googleFontsUrlGroup.style.display = 'block';
    } else {
        customFontGroup.style.display = 'none';
        googleFontsUrlGroup.style.display = 'none';
    }
}

function loadGoogleFont(url) {
    // Remover fuente anterior si existe
    const existingLink = document.querySelector('link[data-google-font]');
    if (existingLink) {
        existingLink.remove();
    }

    // Agregar nueva fuente
    if (url && url.trim()) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.setAttribute('data-google-font', 'true');
        document.head.appendChild(link);

        // Esperar un poco para que la fuente se cargue
        setTimeout(() => {
            document.body.style.fontFamily = 'var(--primary-font)';
        }, 100);
    }
}

function generateGoogleFontsUrl(fontName) {
    if (!fontName || !fontName.trim()) return '';

    // Convertir espacios a + y agregar parámetros estándar
    const formattedName = fontName.trim().replace(/\s+/g, '+');
    return `https://fonts.googleapis.com/css2?family=${formattedName}:wght@300;400;500;600;700&display=swap`;
}

// ===== Inicializar en DOM listo =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('Landing page cargada correctamente');
    loadPageData();
    loadColors();
    loadLogo();
    loadTypography();

    // Inicializar event listeners para tipografía
    initializeTypographyListeners();
});

function initializeTypographyListeners() {
    // Sliders de tamaño
    const sliders = ['h1Size', 'h2Size', 'bodySize', 'lineHeight'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('input', updateTypographyValues);
        }
    });

    // Event listener para cambio de fuente
    const primaryFontSelect = document.getElementById('primaryFont');
    if (primaryFontSelect) {
        primaryFontSelect.addEventListener('change', toggleCustomFontFields);
    }

    // Event listener para generar URL de Google Fonts
    const generateUrlBtn = document.getElementById('generateUrlBtn');
    if (generateUrlBtn) {
        generateUrlBtn.addEventListener('click', () => {
            const fontName = document.getElementById('customFontName').value.trim();
            if (fontName) {
                const url = generateGoogleFontsUrl(fontName);
                document.getElementById('googleFontsUrl').value = url;
                alert('URL generada automáticamente. Ahora puedes guardar los cambios.');
            } else {
                alert('Por favor ingresa el nombre de la fuente primero.');
            }
        });
    }
}
