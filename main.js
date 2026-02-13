/**
 * Valttikodit Website Logic - Main v1.0
 * Handles Google Sheets content fetching and dynamic rendering.
 */

// Configuration: Google Sheets CSV Publish URLs
const CMS_CONFIG = {
    contentUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=193117699&single=true&output=csv',
    projectsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=0&single=true&output=csv',
    modelsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=293113482&single=true&output=csv',
    detailsUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=483496592&single=true&output=csv'
};

// State
let appState = {
    content: {}, // Key-value pairs for text content
    projects: [], // Array of project objects
    models: {},   // Object of model definitions
    projectDetails: [], // Array of {id, category, label, value}
    loaded: false,
    error: null
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    console.log('Valttikodit App Initializing...');
    initMobileMenu();
    loadCMSData();
});

// --- Core Logic ---

async function loadCMSData() {
    console.log('Fetching CMS data in parallel...');

    // 1. Content (Header, Footer, Static Text)
    const contentPromise = fetch(CMS_CONFIG.contentUrl)
        .then(res => {
            if (!res.ok) throw new Error('Content fetch failed');
            return res.text();
        })
        .then(text => {
            appState.content = parseKeyValCSV(text);
            updatePageContent();
            renderDynamicSections();
        })
        .catch(err => console.error('Content Error:', err));

    // 2. Projects (The main grid)
    const projectsPromise = fetch(CMS_CONFIG.projectsUrl)
        .then(res => {
            if (!res.ok) throw new Error('Projects fetch failed');
            return res.text();
        })
        .then(text => {
            appState.projects = parseStandardCSV(text);
            renderProjects(); // Render immediately!
        })
        .catch(err => {
            console.error('Projects Error:', err);
            displayErrorOnPage(err.message);
        });

    // 3. Models (Collection page)
    const modelsPromise = fetch(CMS_CONFIG.modelsUrl)
        .then(res => {
            if (!res.ok) throw new Error('Models fetch failed');
            return res.text();
        })
        .then(text => {
            appState.models = parseModelsCSV(text);
        })
        .catch(err => console.error('Models Error:', err));

    // 4. Details (Project detail specific)
    const detailsPromise = (CMS_CONFIG.detailsUrl ? fetch(CMS_CONFIG.detailsUrl) : Promise.resolve(null))
        .then(res => {
            if (res && !res.ok) throw new Error('Details fetch failed');
            return res ? res.text() : '';
        })
        .then(text => {
            if (text) appState.projectDetails = parseStandardCSV(text);
            // Render specific project details if we are on a project page
            const container = document.getElementById('project-details-container');
            if (container) {
                const projectId = document.body.getAttribute('data-project-id');
                if (projectId) renderProjectDetails(projectId);
            }
        })
        .catch(err => console.error('Details Error:', err));

    // 5. Dependent Logic (Collection needs both Projects and Models)
    Promise.all([projectsPromise, modelsPromise]).then(() => {
        renderCollection();
        checkModeldetail();
        appState.loaded = true;
    });
}

// --- Dynamic Project Details Rendering ---

function renderProjectDetails(projectId) {
    const container = document.getElementById('project-details-container');
    if (!container) return;

    // Filter details for this project
    const details = appState.projectDetails.filter(d => d.id === projectId);

    if (details.length === 0) {
        container.innerHTML = '<p>Ei lisätietoja saatavilla.</p>';
        return;
    }

    // specific sort order for categories if needed, otherwise distinct
    // Lets group first
    const grouped = {};
    const order = []; // to keep track of category order

    details.forEach(item => {
        const cat = item.category || 'Muut';
        if (!grouped[cat]) {
            grouped[cat] = [];
            order.push(cat);
        }
        grouped[cat].push(item);
    });

    let html = '<div class="details-accordion">';

    order.forEach((cat, index) => {
        // Open 'Perustiedot' by default (or the first one if Perustiedot not found, but user specifically asked for Perustiedot)
        const isOpen = cat === 'Perustiedot';
        const activeClass = isOpen ? 'active' : '';
        const openClass = isOpen ? 'open' : '';
        const iconRotation = isOpen ? 'style="transform: rotate(180deg)"' : ''; // Inline style as fallback or rely on CSS class

        html += `
            <div class="accordion-item">
                <div class="accordion-header ${activeClass}" onclick="toggleAccordion(this)">
                    <span class="accordion-title">${cat}</span>
                    <span class="material-icons-round accordion-icon">keyboard_arrow_down</span>
                </div>
                <div class="accordion-content ${openClass}">
                    <table class="apartment-table" style="width: 100%; border: none; margin: 0;">
                        <tbody>
        `;

        grouped[cat].forEach(item => {
            html += `
                <tr>
                    <td style="width: 40%; font-weight: 600; padding: 1rem 1.5rem;">${item.label}</td>
                    <td style="padding: 1rem 1.5rem;">${item.value}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Accordion Toggle Function (Global)
window.toggleAccordion = function (header) {
    const item = header.parentElement;
    const content = header.nextElementSibling;
    const allHeaders = document.querySelectorAll('.accordion-header');
    const allContents = document.querySelectorAll('.accordion-content');

    const wasOpen = header.classList.contains('active');

    // Close all first (requested behavior: only one open)
    allHeaders.forEach(h => h.classList.remove('active'));
    allContents.forEach(c => c.classList.remove('open'));

    // If it wasn't open, open it now
    if (!wasOpen) {
        header.classList.add('active');
        content.classList.add('open');
    }
};

// --- Rendering Functions ---

function updatePageContent() {
    // Finds all elements with data-cms="key" and updates them
    document.querySelectorAll('[data-cms]').forEach(el => {
        const key = el.getAttribute('data-cms');
        if (appState.content[key]) {
            let val = appState.content[key];
            // Auto-optimize: Swap known heavy PNGs to JPGs if they come from Sheets
            if (val && val.toLowerCase() === 'hero-bg.png') val = 'hero-bg.jpg';
            if (val && val.toLowerCase() === 'intro-image.png') val = 'intro-image.jpg';

            if (el.tagName === 'IMG') {
                el.src = val;
            } else {
                el.innerHTML = val;
            }
        }
    });

    // Handle Map Updates specifically
    document.querySelectorAll('[data-cms-map]').forEach(el => {
        const key = el.getAttribute('data-cms-map');
        if (appState.content[key]) {
            const address = appState.content[key];
            // Update iframe src with new address query
            // Using simple embed format: https://maps.google.com/maps?q=[ADDRESS]&output=embed
            el.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
        }
    });

    renderSocialLinks();
}

function renderSocialLinks() {
    // Looks for a container with data-cms-social-container
    // Or we reuse data-cms="footer.social.links" but overwrite it if individual keys exist
    const containers = document.querySelectorAll('[data-cms="footer.social.links"]');
    if (containers.length === 0) return;

    const ig = appState.content['footer.social.instagram'];
    const fb = appState.content['footer.social.facebook'];
    const li = appState.content['footer.social.linkedin'];

    // If no individual keys, we leave the default (which might be the full HTML string from 'footer.social.links')
    // But if ANY individual key exists, we overwrite.
    if (!ig && !fb && !li) return;

    const linksHtml = [];
    if (ig) linksHtml.push(`<p><a href="${ig}" target="_blank">Instagram</a></p>`);
    if (fb) linksHtml.push(`<p><a href="${fb}" target="_blank">Facebook</a></p>`);
    if (li) linksHtml.push(`<p><a href="${li}" target="_blank">LinkedIn</a></p>`);

    containers.forEach(c => {
        c.innerHTML = linksHtml.join('');
    });
}

function renderProjects() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return; // Not on a page with projects grid
    console.log('Rendering Projects Grid...');
    grid.innerHTML = ''; // Clear loading text

    if (!appState.projects || appState.projects.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <h3>Ei julkaistuja kohteita</h3>
                <p>Tarkista Google Sheetsin "Projects"-välilehti.</p>
            </div>
        `;
        return;
    }

    appState.projects.forEach(project => {
        if (!project.name) return; // Skip empty rows

        const isConstruction = project.status === 'construction';
        const isSold = project.status === 'sold';

        // Determine badge class (sold also uses green 'construction' style)
        let badgeClass = 'marketing';
        if (isConstruction || isSold) badgeClass = 'construction';

        // Progress color logic
        let progressColor = 'var(--color-accent-emerald)';
        if (project.status === 'marketing' && project.progress < 20) progressColor = 'var(--color-accent-amber)';
        if (isConstruction) progressColor = 'var(--color-accent-emerald-dark)';

        // Image HTML with Overlay for Sold items
        const imageHtml = isSold
            ? `<div class="project-image-wrapper" style="position: relative;">
                 <img src="${project.image || 'placeholder.jpg'}" alt="${project.name}" class="project-image" style="opacity: 0.9;" loading="lazy">
                 <div class="sold-overlay">MYYTY</div>
               </div>`
            : `<img src="${project.image || 'placeholder.jpg'}" alt="${project.name}" class="project-image" loading="lazy">`;

        // Progress Bar Logic
        let progressBarHtml = '';
        if (project.progress !== null && project.progress !== '') {
            progressBarHtml = `
                <div class="progress-container">
                    <div class="progress-label">
                        <span>${project.readiness || (isConstruction ? 'Rakentaminen käynnissä' : 'Varausaste')}</span>
                        <span>${project.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress}%; background-color: ${progressColor};"></div>
                    </div>
                    ${project.marketingText ? `<p style="font-size: 0.8rem; margin-top: 0.5rem; margin-bottom: 0;">${project.marketingText}</p>` : ''}
                </div>`;
        } else {
            // If no progress bar, but marketing text exists, show it directly with top margin
            if (project.marketingText) {
                progressBarHtml = `<p style="font-size: 0.8rem; margin-top: 1.5rem; margin-bottom: 0; color: var(--color-text-secondary);">${project.marketingText}</p>`;
            }
        }

        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            ${imageHtml}
            <div class="project-content">
                <span class="status-badge ${badgeClass}">${project.statusText || 'Ennakkomarkkinointi'}</span>
                <h3 class="collection-title">${project.name}</h3>
                <div class="collection-meta" style="color: var(--color-text-secondary);">${project.location || ''}</div>
                <p style="margin-top: 0.5rem; font-weight: 700;">${project.price || ''}</p>
                
                ${progressBarHtml}
                
                <div style="margin-top: auto; padding-top: 1.5rem;">
                    <a href="${project.link || '#'}" class="btn btn-accent" style="width: 100%; text-align: center; display: block;">Tutustu kohteeseen</a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}
// ... (lines 316-390 unchanged) ...
function parseStandardCSV(text) {
    const rows = parseCSVLineAware(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim());
    const data = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < headers.length) continue;

        let obj = {};
        headers.forEach((h, index) => {
            let val = row[index] || '';
            if (h === 'progress') {
                // If empty string, keep as null to indicate "hide progress bar"
                // Otherwise parse as int
                val = val.trim() === '' ? null : (parseInt(val, 10) || 0);
            }
            obj[h] = val;
        });
        data.push(obj);
    }
    return data;
}

function parseModelsCSV(text) {
    const rows = parseStandardCSV(text); // Reuse standard parser to get array of objects
    const models = {};
    rows.forEach(row => {
        // Transform pipe-separated images
        let images = [row.mainImage];
        if (row.images && row.images.includes('|')) {
            images = row.images.split('|').map(s => s.trim());
        } else if (row.images) {
            images = [row.images];
        }

        models[row.id] = {
            title: row.title,
            size: row.size,
            meta: row.size,
            shortDesc: row.shortDesc,
            description: row.description,
            images: images,
            specs: [
                { label: 'Huoneistoala', value: row.specs_room_sqm },
                { label: 'Kerrosala', value: row.specs_total_sqm },
                { label: 'Makuuhuoneet', value: row.specs_bedrooms },
                { label: 'Kylpyhuoneet', value: row.specs_bathrooms }
            ],
            detailedSpecs: [
                { label: 'Huoneistoala', value: row.specs_room_sqm },
                { label: 'Kerrosala', value: row.specs_total_sqm }
            ]
        };
    });
    return models;
}

function parseKeyValCSV(text) {
    const rows = parseStandardCSV(text);
    const content = {};
    rows.forEach(row => {
        if (row.id && row.content) {
            content[row.id] = row.content;
        }
    });
    return content;
}

// Robust CSV Line Parser (Handles quotes)
function parseCSVLineAware(text) {
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
        if (!line.trim()) return null;
        const result = [];
        let start = 0;
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                let field = line.substring(start, i).trim();
                // Unquote
                if (field.startsWith('"') && field.endsWith('"')) {
                    field = field.substring(1, field.length - 1).replace(/""/g, '"');
                }
                result.push(field);
                start = i + 1;
            }
        }
        // Last field
        let field = line.substring(start).trim();
        if (field.startsWith('"') && field.endsWith('"')) {
            field = field.substring(1, field.length - 1).replace(/""/g, '"');
        }
        result.push(field);
        return result;
    }).filter(row => row !== null);
}

// --- UI Helpers ---

function displayErrorOnPage(msg) {
    const grid = document.getElementById('projects-grid') || document.body;
    const errorBox = document.createElement('div');
    errorBox.style.cssText = 'background: #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 8px; margin: 2rem; border: 1px solid #f87171;';
    errorBox.innerHTML = `<strong>Virhe ladattaessa sisältöä:</strong> ${msg}<br>Tarkista onhan Google Sheets julkaistu (File > Share > Publish to web).`;
    grid.prepend(errorBox);
}

function initMobileMenu() {
    window.toggleMobileMenu = function () {
        document.querySelector('.nav-links').classList.toggle('active');
    };

    // Close on click
    document.querySelectorAll('.nav-link').forEach(l => {
        l.addEventListener('click', () => {
            document.querySelector('.nav-links').classList.remove('active');
        });
    });
}

// Global for inline onclick handlers
let currentDetailData = null;
let currentDetailImgIdx = 0;

window.openModelDetail = function (id) {
    currentDetailData = appState.models[id];
    if (!currentDetailData) return;

    const view = document.getElementById('model-details-view');
    if (!view) return;

    // Fill data
    document.getElementById('detail-title').innerText = currentDetailData.title;
    document.getElementById('detail-size').innerText = currentDetailData.size;
    document.getElementById('detail-description').innerHTML = currentDetailData.description;

    // Specs in table
    const tableBody = document.getElementById('detail-specs-table-body');
    if (tableBody) {
        tableBody.innerHTML = currentDetailData.specs.map(s =>
            `<tr><td style="font-weight:600;">${s.label}</td><td>${s.value}</td></tr>`
        ).join('');
        // Also add detailed specs if any
        if (currentDetailData.detailedSpecs) {
            tableBody.innerHTML += currentDetailData.detailedSpecs.map(s =>
                `<tr><td style="font-weight:600;">${s.label}</td><td>${s.value}</td></tr>`
            ).join('');
        }
    }

    // Image
    currentDetailImgIdx = 0;
    updateDetailImage();

    view.classList.remove('hidden');
    view.scrollIntoView({ behavior: 'smooth' });
};

window.nextImage = function () {
    if (!currentDetailData) return;
    currentDetailImgIdx = (currentDetailImgIdx + 1) % currentDetailData.images.length;
    updateDetailImage();
};

window.prevImage = function () {
    if (!currentDetailData) return;
    currentDetailImgIdx = (currentDetailImgIdx - 1 + currentDetailData.images.length) % currentDetailData.images.length;
    updateDetailImage();
};

function updateDetailImage() {
    const img = document.getElementById('detail-image');
    if (img && currentDetailData) img.src = currentDetailData.images[currentDetailImgIdx];
}

window.toggleDetailedSpecs = function () {
    const c = document.getElementById('detailed-specs-container');
    c.classList.toggle('hidden');
};

// --- Dynamic Sections Rendering (Services, Philosophy, Trust) ---

const ICON_MAP = {
    // Services
    'home.services.item1': 'edit',
    'home.services.item2': 'home_work',
    'home.services.item3': 'manage_accounts',
    // Philosophy
    'home.philosophy.item1': 'energy_savings_leaf', // '🌱' replacement
    'home.philosophy.item2': 'verified_user', // '🛡️' replacement
    // Trust
    'home.trust.item1': 'person',
    'home.trust.item2': 'menu_book',
    'home.trust.item3': 'visibility',
    // Fallback
    'default': 'star'
};

function renderDynamicSections() {
    renderGenericList('services-grid', 'home.services', 'trust-item', true);
    renderPhilosophyList();
    renderGenericList('trust-grid', 'home.trust', 'trust-item', false);
}

function renderGenericList(containerId, prefix, itemClass, centerText = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Find all items: keyPrefix.itemX.title
    const items = [];
    Object.keys(appState.content).forEach(key => {
        if (key.startsWith(prefix + '.item') && key.endsWith('.title')) {
            // Extract item ID (e.g. 'item1')
            const parts = key.split('.');
            const itemKey = parts[parts.length - 2]; // item1
            items.push(itemKey);
        }
    });

    // Unique and Sort
    const uniqueItems = [...new Set(items)].sort();

    // Fallbacks if no items found (to not break UI if Sheet is empty/old)
    if (uniqueItems.length === 0) {
        console.warn(`No dynamic items found for ${prefix}, using fallbacks if hardcoded available.`);
        // For now we just return, assuming user will update sheet. 
        // Or we could leave the HTML hardcoded and only clear if we find items.
        // But the plan was to clear HTML.
        return;
    }

    uniqueItems.forEach(itemKey => {
        const fullKey = `${prefix}.${itemKey}`;
        const title = appState.content[`${fullKey}.title`] || '';
        const text = appState.content[`${fullKey}.text`] || '';

        // Icon: check sheet first (.icon), then fallback map, then default
        let icon = appState.content[`${fullKey}.icon`];
        if (!icon) icon = ICON_MAP[fullKey] || ICON_MAP['default'];

        const div = document.createElement('div');
        div.className = itemClass;
        if (centerText) div.style.textAlign = 'center';

        const iconStyle = centerText ? 'margin: 0 auto 1.5rem;' : '';

        div.innerHTML = `
            <div class="trust-icon" style="${iconStyle}">
                <span class="material-icons-round">${icon}</span>
            </div>
            <h3>${title}</h3>
            <p>${text}</p>
        `;
        container.appendChild(div);
    });
}

function renderPhilosophyList() {
    const container = document.getElementById('philosophy-container');
    if (!container) return;

    container.innerHTML = '';

    // Same logic to find items
    const items = [];
    Object.keys(appState.content).forEach(key => {
        if (key.startsWith('home.philosophy.item') && key.endsWith('.title')) {
            const parts = key.split('.');
            const itemKey = parts[parts.length - 2];
            items.push(itemKey);
        }
    });
    const uniqueItems = [...new Set(items)].sort();

    uniqueItems.forEach(itemKey => {
        const fullKey = `home.philosophy.${itemKey}`;
        const title = appState.content[`${fullKey}.title`] || '';
        const text = appState.content[`${fullKey}.text`] || '';

        let icon = appState.content[`${fullKey}.icon`];
        if (!icon) icon = ICON_MAP[fullKey] || ICON_MAP['default'];

        const div = document.createElement('div');
        div.style.cssText = 'display: flex; gap: 1rem; margin-bottom: 2rem;';

        // Special logic: last item typically has no bottom margin in some designs, but flex gap handles it usually.
        // Replicating specific inline styles from HTML
        div.innerHTML = `
            <div class="trust-icon" style="flex-shrink: 0; width: 50px; height: 50px; font-size: 1.5rem;">
                <span class="material-icons-round">${icon}</span>
            </div>
            <div>
                <h3>${title}</h3>
                <p style="margin-bottom: 0;">${text}</p>
            </div>
        `;
        container.appendChild(div);
    });
}
