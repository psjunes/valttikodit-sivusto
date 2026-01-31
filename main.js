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
    try {
        console.log('Fetching CMS data...');
        // If detailsUrl is empty, we just skip it or fetch empty
        const fetchDetails = CMS_CONFIG.detailsUrl ? fetch(CMS_CONFIG.detailsUrl) : Promise.resolve({ ok: true, text: () => '' });

        const [contentRes, projectsRes, modelsRes, detailsRes] = await Promise.all([
            fetch(CMS_CONFIG.contentUrl),
            fetch(CMS_CONFIG.projectsUrl),
            fetch(CMS_CONFIG.modelsUrl),
            fetchDetails
        ]);

        if (!contentRes.ok || !projectsRes.ok || !modelsRes.ok) {
            throw new Error('Network response was not ok');
        }

        const contentText = await contentRes.text();
        const projectsText = await projectsRes.text();
        const modelsText = await modelsRes.text();
        const detailsText = CMS_CONFIG.detailsUrl ? await detailsRes.text() : '';

        // Parse Data
        appState.content = parseKeyValCSV(contentText);
        appState.projects = parseStandardCSV(projectsText);
        appState.models = parseModelsCSV(modelsText);

        // Parse Details (Standard CSV parser works fine: id, category, label, value)
        if (detailsText) {
            appState.projectDetails = parseStandardCSV(detailsText);
        } else {
            // Use empty array if no data
            appState.projectDetails = [];
            console.log('No details data found or URL not configured.');
        }

        appState.loaded = true;

        console.log('CMS Data Loaded Successfully', appState);

        // Render Content
        updatePageContent();
        renderProjects();
        renderCollection();

        // Check if we are on a detail page
        checkModeldetail();

        // Render project details if container exists
        const projectDetailsContainer = document.getElementById('project-details-container');
        if (projectDetailsContainer) {
            // Get project ID from body data attribute
            const projectId = document.body.getAttribute('data-project-id');
            if (projectId) renderProjectDetails(projectId);
        }

    } catch (err) {
        console.error('CMS Load Failed:', err);
        appState.error = err;
        displayErrorOnPage(err.message);
    }
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

    // Group by category if present, or just list
    // We will use a single table but insert headers for categories

    // Sort logic: use original order from sheet, but maybe group?
    // Let's assume the sheet order is the desired display order.

    let html = '<table class="apartment-table" style="max-width: 800px; margin: 0 auto; text-align: left;"><tbody>';

    let lastCategory = null;

    details.forEach(item => {
        if (item.category && item.category !== lastCategory) {
            // Insert Category Header
            html += `
                <tr style="background-color: transparent; border-bottom: none;">
                    <td colspan="2" style="padding-top: 1.5rem; padding-bottom: 0.5rem; font-family: var(--font-serif); font-size: 1.2rem; font-weight: bold; color: var(--color-text-primary); border-bottom: none;">
                        ${item.category}
                    </td>
                </tr>
            `;
            lastCategory = item.category;
        }

        html += `
            <tr>
                <td style="width: 40%; font-weight: 600;">${item.label}</td>
                <td>${item.value}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// --- Rendering Functions ---

function updatePageContent() {
    // Finds all elements with data-cms="key" and updates them
    document.querySelectorAll('[data-cms]').forEach(el => {
        const key = el.getAttribute('data-cms');
        if (appState.content[key]) {
            if (el.tagName === 'IMG') {
                el.src = appState.content[key];
            } else {
                el.innerHTML = appState.content[key];
            }
        }
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
        const badgeClass = isConstruction ? 'construction' : 'marketing';
        let progressColor = 'var(--color-accent-emerald)';
        if (project.status === 'marketing' && project.progress < 20) progressColor = 'var(--color-accent-amber)';
        if (isConstruction) progressColor = 'var(--color-accent-emerald-dark)';

        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <img src="${project.image || 'placeholder.jpg'}" alt="${project.name}" class="project-image">
            <div class="project-content">
                <span class="status-badge ${badgeClass}">${project.statusText || 'Ennakkomarkkinointi'}</span>
                <h3 class="collection-title">${project.name}</h3>
                <div class="collection-meta" style="color: var(--color-text-secondary);">${project.location || ''}</div>
                <p style="margin-top: 0.5rem; font-weight: 700;">${project.price || ''}</p>
                
                <div class="progress-container">
                    <div class="progress-label">
                        <span>${isConstruction ? 'Rakentaminen käynnissä' : 'Varausaste'}</span>
                        <span>${project.progress || 0}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress || 0}%; background-color: ${progressColor};"></div>
                    </div>
                    ${project.marketingText ? `<p style="font-size: 0.8rem; margin-top: 0.5rem; margin-bottom: 0;">${project.marketingText}</p>` : ''}
                </div>
                
                <div style="margin-top: auto;">
                    <a href="${project.link || '#'}" class="btn ${isConstruction ? 'btn-secondary' : 'btn-accent'}" style="width: 100%; text-align: center; display: block;">Tutustu kohteeseen</a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderCollection() {
    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    // Check if we are on index page (hero exists) to determine styling
    const isIndex = !!document.querySelector('.hero');
    grid.innerHTML = '';

    Object.keys(appState.models).forEach(id => {
        const model = appState.models[id];
        // Find active project for this model
        const activeProject = appState.projects.find(p => p.modelId === id && p.status !== 'sold');

        let extraHtml = '';
        if (activeProject) {
            if (isIndex) {
                extraHtml = `
                    <div style="margin-top: 1rem; padding: 0.5rem 1rem; background-color: #ecfdf5; border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--color-accent-emerald-dark); display: flex; align-items: center; gap: 0.5rem;">
                         <span class="material-icons-round" style="font-size: 1rem;">construction</span>
                         <span>Rakennettavana: <strong>${activeProject.name}</strong></span>
                    </div>`;
            } else {
                extraHtml = `
                    <div class="cross-link-box">
                        <p>Ihastuitko tähän malliin?</p>
                        <a href="${activeProject.link}">Rakennamme tätä juuri nyt: <strong>${activeProject.name} &rarr;</strong></a>
                    </div>`;
            }
        } else if (!isIndex) {
            extraHtml = `<div style="margin-top: auto;"></div>`;
        }

        const btnClass = isIndex ? 'btn-card' : 'btn btn-secondary';
        const linkAction = isIndex ? `href="collection.html?model=${id}"` : `onclick="openModelDetail('${id}')"`;
        const btnTag = isIndex ? 'a' : 'button';

        const card = document.createElement('div');
        card.className = 'collection-card';
        card.innerHTML = `
            <img src="${model.images[0]}" alt="${model.title}" class="collection-image">
            <div class="collection-content">
                <div class="collection-meta">${model.meta}</div>
                <h3 class="collection-title">${model.title}</h3>
                <p class="collection-desc">${model.shortDesc}</p>
                ${!isIndex ? extraHtml : ''}
                <${btnTag} ${linkAction} class="${btnClass}">Tutustu malliin</${btnTag}>
                ${isIndex ? extraHtml : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

function checkModeldetail() {
    const params = new URLSearchParams(window.location.search);
    const modelId = params.get('model');
    if (modelId && appState.models[modelId]) {
        openModelDetail(modelId);
    }
}

// --- Helpers & Parsers ---

function parseKeyValCSV(text) {
    const rows = parseCSVLineAware(text);
    const content = {};
    rows.forEach(row => {
        // Assume row[0] is ID, row[1] is Content
        if (row[0] && row[1]) content[row[0]] = row[1];
    });
    return content;
}

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
            if (h === 'progress') val = parseInt(val, 10) || 0;
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
