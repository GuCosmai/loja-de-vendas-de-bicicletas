import { firebaseConfig, appId, geminiApiKey } from './config.js';

// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    onSnapshot, 
    collection, 
    query,
    serverTimestamp,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Inicializa Firebase
let app, db, auth;
let userId = null;
let isAdmin = false;

// Elementos da DOM
const adminPanel = document.getElementById('admin-panel');
const adminToggleContainer = document.getElementById('admin-toggle-container');
const adminToggleButton = document.getElementById('admin-toggle-btn');
const bikeGallery = document.getElementById('bike-gallery');
const addBikeForm = document.getElementById('add-bike-form');
const addBikeButton = document.getElementById('add-bike-button');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const searchBar = document.getElementById('search-bar');
const sortBy = document.getElementById('sort-by');

// Novos elementos da API Gemini
const generateDescBtn = document.getElementById('generate-description-btn');
const bikeDescriptionTextarea = document.getElementById('bike-description');
const descLoading = document.getElementById('desc-loading');

// Elementos do Modal
const modalOverlay = document.getElementById('image-modal-overlay');
const modalContent = document.getElementById('image-modal-content');
const modalCloseBtn = document.getElementById('image-modal-close');
const modalImg = document.getElementById('image-modal-img');
const modalPrevBtn = document.getElementById('modal-prev-btn');
const modalNextBtn = document.getElementById('modal-next-btn');
const modalCounter = document.getElementById('image-modal-counter');

// Estado do Modal
let currentModalImages = [];
let currentModalIndex = 0;

// Referências do Firestore
let bikesCollectionRef;
let adminConfigDocRef;
let allBikes = [];

/**
 * Inicializa o Firebase e os serviços
 */
function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('Debug'); // Habilita logs para depuração
        setupAuthListener();
    } catch (error) {
        console.error("Erro ao inicializar o Firebase:", error);
        bikeGallery.innerHTML = "<p class='text-red-500'>Erro ao conectar com o banco de dados.</p>";
    }
}

/**
 * Configura o listener de autenticação
 */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("Usuário autenticado:", userId);
            
            bikesCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'bikes');
            adminConfigDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'admin');
            
            await checkAdminStatus(userId);
            loadBikes();

        } else {
            console.log("Nenhum usuário. Tentando login...");
            signIn();
        }
    });
}

/**
 * Tenta fazer login anônimo ou com token
 */
async function signIn() {
    try {
        // O token inicial foi removido, pois agora a configuração é feita no config.js
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Erro ao fazer login:", error);
    }
}

/**
 * Verifica se o usuário atual é o admin.
 */
async function checkAdminStatus(currentUserId) {
    try {
        const docSnap = await getDoc(adminConfigDocRef);
        
        if (docSnap.exists() && docSnap.data().ownerId) {
            isAdmin = docSnap.data().ownerId === currentUserId;
        } else {
            console.log("Nenhum admin encontrado. Definindo usuário atual como admin.");
            await setDoc(adminConfigDocRef, { ownerId: currentUserId });
            isAdmin = true;
        }
        
        updateAdminUI();

    } catch (error) {
        console.error("Erro ao verificar status de admin:", error);
    }
}

/**
 * Mostra ou oculta o painel de admin
 */
function updateAdminUI() {
    adminToggleContainer.classList.toggle('hidden', !isAdmin);
    if (!isAdmin) {
        adminPanel.classList.add('hidden');
    }
}

/**
 * Carrega as bicicletas do Firestore em tempo real
 */
function loadBikes() {
    const q = query(bikesCollectionRef);
    
    onSnapshot(q, (snapshot) => {
        loadingState.classList.add('hidden');
        
        if (snapshot.empty) {
            emptyState.classList.remove('hidden');
            bikeGallery.innerHTML = '';
        } else {
            emptyState.classList.add('hidden');
            allBikes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderGallery(allBikes);
        }
    }, (error) => {
        console.error("Erro ao carregar bicicletas:", error);
        loadingState.classList.add('hidden');
        bikeGallery.innerHTML = "<p class='text-red-500'>Erro ao carregar os dados.</p>";
    });
}

/**
 * Renderiza a galeria com uma lista de bicicletas
 */
function renderGallery(bikes) {
    bikeGallery.innerHTML = '';
    bikes.forEach(bike => {
        renderBikeCard(bike.id, bike);
    });
}

/**
 * Renderiza um card de bicicleta na galeria
 */
function renderBikeCard(id, data) {
    const price = data.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.price) : 'Preço indisponível';
    const mainImageUrl = data.images && data.images.length > 0 ? data.images[0] : 'https://placehold.co/600x400/e2e8f0/94a3b8?text=Sem+Imagem';
    
    const card = document.createElement('div');
    card.className = "bike-card bg-white rounded-lg shadow-md overflow-hidden transition-shadow duration-300 hover:shadow-xl relative cursor-pointer";
    card.dataset.images = JSON.stringify(data.images || []);

    let deleteButtonHtml = '';
    if (isAdmin) {
        deleteButtonHtml = `
            <button data-id="${id}" class="delete-btn absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 z-10" title="Remover Bicicleta">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
            </button>
        `;
    }

    card.innerHTML = `
        ${deleteButtonHtml}
        <img src="${mainImageUrl}" alt="[Imagem de ${data.model || 'bicicleta'}]" class="w-full h-56 object-cover pointer-events-none" onerror="this.src='https://placehold.co/600x400/e2e8f0/94a3b8?text=Imagem+Inválida'">
        <div class="p-4 pointer-events-none">
            <h3 class="text-xl font-semibold text-gray-900 truncate" title="${data.model}">${data.model || 'Modelo não informado'}</h3>
            <p class="text-gray-600 mb-3">${data.brand || 'Marca não informada'}</p>
            ${data.description ? `<p class="text-gray-500 text-sm mb-3">${data.description}</p>` : ''}
            <p class="text-2xl font-bold text-blue-600">${price}</p>
        </div>
    `;
    
    bikeGallery.appendChild(card);
}

/**
 * Manipulador para adicionar uma nova bicicleta
 */
async function handleAddBike(event) {
    event.preventDefault();
    if (!isAdmin) return;

    const model = addBikeForm['bike-model'].value.trim();
    const brand = addBikeForm['bike-brand'].value.trim();
    const price = parseFloat(addBikeForm['bike-price'].value);
    const description = bikeDescriptionTextarea.value.trim();
    const imageUrls = addBikeForm['bike-image-urls'].value.split(',').map(url => url.trim()).filter(url => url.length > 0);

    if (!model || !brand || !price || imageUrls.length === 0) {
        console.error("Formulário inválido ou sem imagens");
        return;
    }

    addBikeButton.disabled = true;
    addBikeButton.textContent = 'Adicionando...';

    try {
        await addDoc(bikesCollectionRef, {
            model: model,
            brand: brand,
            price: price,
            images: imageUrls,
            description: description,
            createdAt: serverTimestamp()
        });
        
        addBikeForm.reset();

    } catch (error) {
        console.error("Erro ao adicionar bicicleta:", error);
    } finally {
        addBikeButton.disabled = false;
        addBikeButton.textContent = 'Adicionar Bicicleta';
    }
}

/**
 * Manipulador para remover uma bicicleta
 */
async function handleDeleteBike(deleteButton) {
    const bikeId = deleteButton.dataset.id;
    console.log("Deletando bicicleta:", bikeId);
    
    try {
        const bikeDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'bikes', bikeId);
        await deleteDoc(bikeDocRef);
    } catch (error) {
        console.error("Erro ao deletar bicicleta:", error);
    }
}

function handleGalleryClick(event) {
    const deleteButton = event.target.closest('.delete-btn');
    if (deleteButton && isAdmin) {
        event.stopPropagation();
        handleDeleteBike(deleteButton);
        return;
    }

    const bikeCard = event.target.closest('.bike-card');
    if (bikeCard) {
        const imagesJson = bikeCard.dataset.images;
        if (imagesJson) {
            try {
                const images = JSON.parse(imagesJson);
                if (images.length > 0) {
                    openModal(images);
                } else {
                    console.log("Este card não tem imagens para o modal.");
                }
            } catch (e) {
                console.error("Erro ao ler imagens do card:", e);
            }
        }
    }
}

function openModal(images) {
    currentModalImages = images;
    currentModalIndex = 0;
    
    const navVisible = images.length > 1;
    modalPrevBtn.classList.toggle('hidden', !navVisible);
    modalNextBtn.classList.toggle('hidden', !navVisible);
    modalCounter.classList.toggle('hidden', !navVisible);

    showModalImage(0);

    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
        modalOverlay.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function closeModal() {
    modalOverlay.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
        modalImg.src = "";
        currentModalImages = [];
        currentModalIndex = 0;
    }, 300);
}

function showModalImage(index) {
    currentModalIndex = index;
    modalImg.src = currentModalImages[index];
    modalCounter.textContent = `${index + 1} / ${currentModalImages.length}`;
    
    modalImg.onerror = () => {
        modalImg.src = 'https://placehold.co/800x600/e2e8f0/94a3b8?text=Imagem+Inválida';
    };
}

async function fetchWithBackoff(url, options, retries = 3, delay = 1000) {
    try {
        const response = await fetch(url, options);
        if (response.status === 429 || response.status >= 500) { 
            if (retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return fetchWithBackoff(url, options, retries - 1, delay * 2);
            }
            throw new Error("API Gemini: Máximo de retentativas excedido.");
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            await new Promise(res => setTimeout(res, delay));
            return fetchWithBackoff(url, options, retries - 1, delay * 2);
        }
        throw error;
    }
}

async function callGeminiAPI(systemPrompt, userQuery) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    
    const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

    try {
        const response = await fetchWithBackoff(apiUrl, options);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Erro da API Gemini: ${response.statusText}`);
        }
        
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            return text;
        } else {
            throw new Error("Nenhuma resposta de texto válida da API Gemini.");
        }
    } catch (error) {
        console.error("Falha ao chamar a API Gemini:", error);
        throw error;
    }
}

async function handleGenerateDescription(event) {
    event.preventDefault();

    const model = addBikeForm['bike-model'].value.trim();
    const brand = addBikeForm['bike-brand'].value.trim();
    const price = addBikeForm['bike-price'].value;

    if (!model || !brand) {
        bikeDescriptionTextarea.placeholder = "Por favor, preencha o Modelo e a Marca primeiro.";
        return;
    }

    descLoading.classList.remove('hidden');
    generateDescBtn.disabled = true;
    bikeDescriptionTextarea.value = "";
    bikeDescriptionTextarea.placeholder = "A pensar...";

    const systemPrompt = "Você é um assistente de marketing digital para uma loja de bicicletas. A sua tarefa é escrever descrições de produtos curtas, vibrantes e atraentes (máximo 2-3 frases) em Português (Portugal).";
    const userQuery = `Por favor, crie uma descrição para esta bicicleta: Modelo: '${model}', Marca: '${brand}', Preço: R$${price || 'não especificado'}'. Foque no estilo de vida e nos principais benefícios (ex: velocidade, conforto, aventura).`;

    try {
        const description = await callGeminiAPI(systemPrompt, userQuery);
        bikeDescriptionTextarea.value = description.trim();
    } catch (error) {
        bikeDescriptionTextarea.placeholder = "Ocorreu um erro ao gerar a descrição.";
    } finally {
        descLoading.classList.add('hidden');
        generateDescBtn.disabled = false;
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        darkModeToggle.textContent = 'Modo Claro';
    } else {
        document.body.classList.remove('dark');
        darkModeToggle.textContent = 'Modo Escuro';
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

function filterAndSortBikes() {
    let filteredBikes = [...allBikes];
    const searchQuery = searchBar.value.toLowerCase();

    if (searchQuery) {
        filteredBikes = filteredBikes.filter(bike => 
            bike.model.toLowerCase().includes(searchQuery) || 
            bike.brand.toLowerCase().includes(searchQuery)
        );
    }

    const sortValue = sortBy.value;
    if (sortValue !== 'default') {
        const [key, order] = sortValue.split('-');
        filteredBikes.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            if (key === 'price') {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    renderGallery(filteredBikes);
}

document.addEventListener('DOMContentLoaded', () => {
    addBikeForm.addEventListener('submit', handleAddBike);
    bikeGallery.addEventListener('click', handleGalleryClick);
    adminToggleButton.addEventListener('click', () => {
        const isHidden = adminPanel.classList.toggle('hidden');
        adminToggleButton.textContent = isHidden ? 'Mostrar Painel de Administrador' : 'Ocultar Painel de Administrador';
        if (!isHidden) {
            adminPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    generateDescBtn.addEventListener('click', handleGenerateDescription);
    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) closeModal();
    });
    modalPrevBtn.addEventListener('click', () => {
        const newIndex = (currentModalIndex - 1 + currentModalImages.length) % currentModalImages.length;
        showModalImage(newIndex);
    });
    modalNextBtn.addEventListener('click', () => {
        const newIndex = (currentModalIndex + 1) % currentModalImages.length;
        showModalImage(newIndex);
    });

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    darkModeToggle.addEventListener('click', toggleTheme);
    searchBar.addEventListener('input', filterAndSortBikes);
    sortBy.addEventListener('change', filterAndSortBikes);
    
    initFirebase();
});