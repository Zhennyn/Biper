const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnExport = document.getElementById('btn-export');
const btnClear = document.getElementById('btn-clear');
const listContainer = document.getElementById('scanned-list');
const scanCountEl = document.getElementById('scan-count');
const scannerOverlay = document.querySelector('.scanner-overlay');
const btnNative = document.getElementById('btn-native');
const nativeCameraInput = document.getElementById('native-camera-input');

let html5QrCode;
let scannedItems = [];
let isScanning = false;
let lastScannedCode = null;
let lastScannedTime = 0;

// Initialize the scanner
function initScanner() {
    // Focar em códigos de barras de produtos (EAN/UPC) melhora a precisão e velocidade
    html5QrCode = new Html5Qrcode("reader", {
        formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
        ]
    });
}

function renderList() {
    if (scannedItems.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">Nenhum item escaneado ainda.</div>';
        scanCountEl.textContent = '0';
        return;
    }

    listContainer.innerHTML = '';
    // Display latest items first
    const reversed = [...scannedItems].reverse();
    
    reversed.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';
        
        const codeSpan = document.createElement('span');
        codeSpan.className = 'list-item-code';
        codeSpan.textContent = item.ean;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'list-item-time';
        timeSpan.textContent = item.time;

        div.appendChild(codeSpan);
        div.appendChild(timeSpan);
        listContainer.appendChild(div);
    });

    scanCountEl.textContent = scannedItems.length;
}

function handleScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    
    // Prevent double scanning the exact same code within 1.5 seconds
    if (decodedText === lastScannedCode && (now - lastScannedTime) < 1500) {
        return;
    }

    lastScannedCode = decodedText;
    lastScannedTime = now;

    // Visual feedback
    document.getElementById('reader-wrapper').style.borderColor = 'var(--success-color)';
    setTimeout(() => {
        document.getElementById('reader-wrapper').style.borderColor = 'var(--border-color)';
    }, 300);

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second:'2-digit' });

    scannedItems.push({
        ean: decodedText,
        time: timeString
    });

    // Save to local storage for persistence
    saveToStorage();
    renderList();
}

function startScanner() {
    if (!html5QrCode) initScanner();

    // Redimensionar qrbox dependendo do tamanho da tela
    const boxWidth = window.innerWidth > 400 ? 300 : 250;
    
    const config = { 
        fps: 15, // Mais frames por segundo = leitura mais rápida
        qrbox: { width: boxWidth, height: 100 }, // Caixa retangular, ideal para EAN
        aspectRatio: 1.0,
        disableFlip: false
    };

    html5QrCode.start(
        { facingMode: "environment" }, // Câmera traseira (fallback seguro)
        config,
        handleScanSuccess,
        (errorMessage) => {
            // parse errors are normal and happen continuously when no code is found
        }
    ).then(() => {
        isScanning = true;
        btnStart.style.display = 'none';
        btnStop.style.display = 'inline-flex';
        scannerOverlay.classList.add('active');
    }).catch((err) => {
        console.error("Camera start error", err);
        alert("Erro ao iniciar a câmera. Verifique as permissões.");
    });
}

function stopScanner() {
    if (html5QrCode && isScanning) {
        html5QrCode.stop().then(() => {
            isScanning = false;
            btnStart.style.display = 'inline-flex';
            btnStop.style.display = 'none';
            scannerOverlay.classList.remove('active');
        }).catch(err => {
            console.error("Camera stop error", err);
        });
    }
}

// Export to Excel
function exportToExcel() {
    if (scannedItems.length === 0) {
        alert("A lista está vazia!");
        return;
    }

    // Format data for sheet: just the EAN as requested
    const worksheetData = scannedItems.map(item => ({
        "EAN": item.ean
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scans");

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, "Biper_Export.xlsx");
}

function clearList() {
    if (confirm("Tem certeza que deseja limpar todos os itens?")) {
        scannedItems = [];
        saveToStorage();
        renderList();
    }
}

// Local Storage Persistence
function saveToStorage() {
    localStorage.setItem('biper_scans', JSON.stringify(scannedItems));
}

function loadFromStorage() {
    const stored = localStorage.getItem('biper_scans');
    if (stored) {
        try {
            scannedItems = JSON.parse(stored);
            renderList();
        } catch (e) {
            console.error("Error loading storage", e);
        }
    }
}

// Native Camera Logic
btnNative.addEventListener('click', () => {
    nativeCameraInput.click();
});

nativeCameraInput.addEventListener('change', (e) => {
    if (e.target.files.length === 0) return;
    
    const imageFile = e.target.files[0];
    if (!html5QrCode) initScanner();
    
    // Parar o vídeo se estiver rodando
    if (isScanning) {
        stopScanner();
    }

    // Escanear a imagem estática
    html5QrCode.scanFile(imageFile, true)
        .then(decodedText => {
            handleScanSuccess(decodedText);
        })
        .catch(err => {
            console.error("File scan error:", err);
            alert("Não foi possível ler o código nesta foto. Tente chegar mais perto do código.");
        })
        .finally(() => {
            // Limpa o input para permitir bater outra foto do mesmo arquivo (se necessário)
            e.target.value = "";
        });
});

// Event Listeners
btnStart.addEventListener('click', startScanner);
btnStop.addEventListener('click', stopScanner);
btnExport.addEventListener('click', exportToExcel);
btnClear.addEventListener('click', clearList);

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initScanner();
    loadFromStorage();
});
