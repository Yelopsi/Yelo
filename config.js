// Verifica se você está rodando no seu computador
const isLocalhost = window.location.hostname.includes("localhost") || 
                    window.location.hostname.includes("127.0.0.1");

// Se for local, usa a porta 3001. Se for no Render, usa o link oficial.
const API_BASE_URL = isLocalhost 
    ? "http://localhost:3001" 
    : "https://projeto-girassol.onrender.com"; 

console.log("Ambiente:", isLocalhost ? "Local" : "Produção");