const SHEET_URLS = {
    content: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=193117699&single=true&output=csv',
    projects: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=0&single=true&output=csv',
    models: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuwd0G4OttPpfKAJiKuYhR1ZEPEyZ2wi8ToyN4vnUgXBhvhQuI_kGKszR5zkox45zbkKSrFCWFCHga/pub?gid=293113482&single=true&output=csv'
};

let modelData = {};
let projectsData = [];
let siteContent = {};

// --- Google Sheets Integrations ---

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Simple CSV parser that handles basic comma splitting
    // Note: Does not handle commas inside quotes efficiently, but sufficient for simple data
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Handle basic split but respecting potential future quote needs
        const currentLine = lines[i].split(',');

        let obj = {};
        // Safety check if line doesn't match headers
        if (currentLine.length < headers.length) continue;

        for (let j = 0; j < headers.length; j++) {
            let value = currentLine[j] ? currentLine[j].trim() : '';
            const key = headers[j];

            // Type conversions
            if (key === 'progress') value = parseInt(value, 10) || 0;
            if (key === 'images') value = value.split('|').map(img => img.trim()); // Use pipe for multi-image

            obj[key] = value;
        }
        result.push(obj);
    }
    return result;
}

// Special parser for Models which has nested arrays/objects structure flattened
function processModelsData(rows) {
    const models = {};
    rows.forEach(row => {
        // Reconstruct the complex model object from flat CSV columns
        // Expecting CSV columns: id, title, size, shortDesc, description, mainImage, images(comma sep), specs_room_sqm, specs_total_sqm, specs_bedrooms, specs_bathrooms...

        // Split images by standard comma if present, or just use mainImage
        // The basic parseCSV splits by comma, so 'images' field might be tricky if it contains commas. 
        // For simplicity in this v1, let's assume 'images' column in CSV uses pipe '|' separator if manually edited, 
        // OR we just use the file names we know.

        // Actually, let's fix the parseCSV to treat images column specially or use pipe
        let imageList = [];
        if (row.images && Array.isArray(row.images)) {
            // If parseCSV split it? No, parseCSV returns string for unknown cols usually unless I changed it.
            // Wait, my parseCSV above DOES split by pipe for 'images'.
            imageList = row.images;
        } else if (typeof row.images === 'string') {
            imageList = row.images.split('|');
        } else {
            imageList = [row.mainImage];
        }

        models[row.id] = {
            title: row.title,
            size: row.size,
            meta: row.size, // or row.meta
            images: imageList,
            shortDesc: row.shortDesc,
            description: row.description, // HTML content
            specs: [
                { label: 'Huoneistoala', value: row.specs_room_sqm },
                { label: 'Kerrosala', value: row.specs_total_sqm },
                { label: 'Makuuhuoneet', value: row.specs_bedrooms },
                { label: 'Kylpyhuoneet', value: row.specs_bathrooms }
            ],
            // Detailed specs could be separate columns too, for now keeping basic
            detailedSpecs: [
                { label: 'Huoneistoala', value: row.specs_room_sqm },
                { label: 'Kerrosala', value: row.specs_total_sqm },
                // Add defaults or more columns as needed
            ]
        };
    });
    return models;
}

// Process Content (Key-Value)
function processContentData(rows) {
    const content = {};
    rows.forEach(row => {
        if (row.id && row.content) {
            content[row.id] = row.content;
        }
    });
    return content;
}

async function fetchAllData() {
    try {
        const [contentRes, projectsRes, modelsRes] = await Promise.all([
            fetch(SHEET_URLS.content),
            fetch(SHEET_URLS.projects),
            fetch(SHEET_URLS.models)
        ]);

        const contentText = await contentRes.text();
        const projectsText = await projectsRes.text();
        const modelsText = await modelsRes.text();

        siteContent = processContentData(parseCSV(contentText));
        projectsData = parseCSV(projectsText);

        // Models need special structural parsing
        const flatModels = parseCSV(modelsText);
        modelData = processModelsData(flatModels);

        console.log('CMS Data Loaded:', { siteContent, projectsData, modelData });

        // Once data is loaded...
        applyContent();
        refreshUI();

    } catch (error) {
        console.error('CMS Load Error:', error);
        // Fallback or alert? For now just log. 
        // The static data was overwrite so page might be empty if this fails.
    }
}

function applyContent() {
    // Look for all elements with data-cms attributes
    document.querySelectorAll('[data-cms]').forEach(el => {
        const key = el.getAttribute('data-cms');
        if (siteContent[key]) {
            // Check if it's an image or text
            if (el.tagName === 'IMG') {
                el.src = siteContent[key];
            } else {
                // Determine if HTML or Text
                // For safety, generally use textContent, but our content has <br> etc, so innerHTML
                el.innerHTML = siteContent[key];
            }
        }
    });

    // Also handle Background images specially if needed
    // e.g. .hero { background-image: ... }
    // We can map specific IDs to style changes
    if (siteContent['home.hero.bg']) {
        const hero = document.querySelector('.hero');
        if (hero) hero.style.backgroundImage = `url('${siteContent['home.hero.bg']}')`;
    }
}

function refreshUI() {
    // Re-run render functions
    if (document.getElementById('projects-grid')) renderProjectsList();
    if (document.getElementById('collection-grid')) {
        const isIndex = !!document.querySelector('.hero');
        renderCollectionList(isIndex);
    }

    // Update nav counts
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        // Reset text key? No, just update dynamic parts
        // But we need to be careful not to overwrite the "Myytävät kohteet" text if we translated it
        if (link.href.includes('projects.html')) {
            link.innerText = `Myytävät kohteet (${projectsData.length})`;
        }
    });

    // If on model details page (collection.html?model=...), re-render details
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('model');
    if (modelId && modelData[modelId]) {
        showModelDetails(modelId);
    }
}


let currentModelData = null;
let currentImageIndex = 0;

function showModelDetails(modelId) {
    const data = modelData[modelId];
    if (!data) return;

    currentModelData = data;
    currentImageIndex = 0;

    const detailsContainer = document.getElementById('model-details-view');
    if (!detailsContainer) return;

    // Populate Basic Data
    document.getElementById('detail-title').innerText = data.title;
    document.getElementById('detail-size').innerText = data.size;
    document.getElementById('detail-description').innerHTML = data.description;

    // Setup Carousel
    updateCarouselImage();

    // Populate Specs
    const specsContainer = document.getElementById('detail-specs');
    specsContainer.innerHTML = '';
    data.specs.forEach(spec => {
        const div = document.createElement('div');
        div.className = 'spec-item';
        div.innerHTML = `<span class="spec-label">${spec.label}</span><span class="spec-value">${spec.value}</span>`;
        specsContainer.appendChild(div);
    });

    // Populate Detailed Specs Table
    const tableBody = document.querySelector('#detailed-specs-table tbody');
    tableBody.innerHTML = '';
    data.detailedSpecs.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.label}</td><td>${row.value}</td>`;
        tableBody.appendChild(tr);
    });
    // Hide table initially
    document.getElementById('detailed-specs-container').classList.add('hidden');
    document.getElementById('toggle-specs-btn').innerText = 'Katso tarkemmat tekniset tiedot';


    // Show and scroll
    detailsContainer.classList.remove('hidden');
    detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nextImage() {
    if (!currentModelData) return;
    currentImageIndex = (currentImageIndex + 1) % currentModelData.images.length;
    updateCarouselImage();
}

function prevImage() {
    if (!currentModelData) return;
    currentImageIndex = (currentImageIndex - 1 + currentModelData.images.length) % currentModelData.images.length;
    updateCarouselImage();
}

function updateCarouselImage() {
    const imgElement = document.getElementById('detail-image');
    if (currentModelData && currentModelData.images.length > 0) {
        imgElement.src = currentModelData.images[currentImageIndex];
    }
}

function toggleDetailedSpecs() {
    const container = document.getElementById('detailed-specs-container');
    const btn = document.getElementById('toggle-specs-btn');
    container.classList.toggle('hidden');
    if (container.classList.contains('hidden')) {
        btn.innerText = 'Katso tarkemmat tekniset tiedot';
    } else {
        btn.innerText = 'Piilota tekniset tiedot';
    }
}

// Data Rendering Functions

function renderProjectsList() {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    grid.innerHTML = ''; // Clear default/static content

    projectsData.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';

        let progressColor = 'var(--color-accent-emerald)';
        if (project.status === 'marketing' && project.progress < 20) progressColor = 'var(--color-accent-amber)';
        if (project.status === 'construction') progressColor = 'var(--color-accent-emerald-dark)';

        const badgeClass = project.status === 'construction' ? 'construction' : 'marketing';

        card.innerHTML = `
            <img src="${project.image}" alt="${project.name}" class="project-image">
            <div class="project-content">
                <span class="status-badge ${badgeClass}">${project.statusText}</span>
                <h3 class="collection-title">${project.name}</h3>
                <div class="collection-meta" style="color: var(--color-text-secondary);">${project.location}</div>
                <p style="margin-top: 0.5rem; font-weight: 700;">${project.price}</p>
                
                <div class="progress-container">
                    <div class="progress-label">
                        <span>${project.status === 'construction' ? 'Rakentaminen käynnissä' : 'Varausaste'}</span>
                        <span>${project.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${project.progress}%; background-color: ${progressColor};"></div>
                    </div>
                    ${project.marketingText ? `<p style="font-size: 0.8rem; margin-top: 0.5rem; margin-bottom: 0;">${project.marketingText}</p>` : ''}
                </div>
                
                <div style="margin-top: auto;">
                    <a href="${project.link}" class="btn ${project.status === 'construction' ? 'btn-secondary' : 'btn-accent'}" style="width: 100%; text-align: center; display: block;">Tutustu kohteeseen</a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderCollectionList(isIndexPage = false) {
    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const models = Object.keys(modelData);

    models.forEach(key => {
        const model = modelData[key];
        const card = document.createElement('div');
        card.className = 'collection-card';

        // Check for active projects using this model
        const activeProject = projectsData.find(p => p.modelId === key && p.status !== 'sold');
        let crossLinkHtml = '';

        if (activeProject) {
            if (isIndexPage) {
                // Söpö pieni badge etusivulle
                crossLinkHtml = `
                    <div style="margin-top: 1rem; padding: 0.5rem 1rem; background-color: #ecfdf5; border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--color-accent-emerald-dark); display: flex; align-items: center; gap: 0.5rem;">
                         <span class="material-icons-round" style="font-size: 1rem;">construction</span>
                         <span>Rakennettavana: <strong>${activeProject.name}</strong></span>
                    </div>
                 `;
            } else {
                // Iso boxi kokoelmasivulle
                crossLinkHtml = `
                    <div class="cross-link-box">
                        <p>Ihastuitko tähän malliin?</p>
                        <a href="${activeProject.link}">Rakennamme tätä juuri nyt: <strong>${activeProject.name} &rarr;</strong></a>
                    </div>
                `;
            }
        } else if (!isIndexPage) {
            // Placeholder jos ei aktiivista
            crossLinkHtml = `<div style="margin-top: auto;"></div>`; // Spacer
        }

        const btnClass = isIndexPage ? 'btn-card' : 'btn btn-secondary';
        const linkAction = isIndexPage ? `href="collection.html?model=${key}"` : `onclick="showModelDetails('${key}')"`;
        const btnTag = isIndexPage ? 'a' : 'button';

        card.innerHTML = `
            <img src="${model.images[0]}" alt="${model.title}" class="collection-image">
            <div class="collection-content">
                <div class="collection-meta">${model.meta}</div>
                <h3 class="collection-title">${model.title}</h3>
                <p class="collection-desc">${model.shortDesc}</p>
                ${!isIndexPage ? crossLinkHtml : ''}
                <${btnTag} ${linkAction} class="${btnClass}">Tutustu malliin</${btnTag}>
                ${isIndexPage ? crossLinkHtml : ''}
            </div>
        `;
        grid.appendChild(card);
    });
}

// Init functions based on page
document.addEventListener('DOMContentLoaded', () => {
    // Start data fetch immediately
    fetchAllData();

    // Mobile Menu Close on Link Click
    const mobileLinks = document.querySelectorAll('.nav-link');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            document.querySelector('.nav-links').classList.remove('active');
        });
    });
});

function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');
}
