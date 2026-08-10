const regex = /^[\p{L}\s\-'\.,]+$/u;

const valid = [
    "Dr. João da Silva",
    "Ana-Maria",
    "Müller",
    "Conceição O'Brien, Psicóloga",
    "Ángel",
    "Sônia"
];

const invalid = [
    "Ana Maria 123", 
    "João <script>",
    "Müller!"
];

valid.forEach(v => {
    if(!regex.test(v)) console.log("ERRO (Deveria aceitar): " + v);
});

invalid.forEach(v => {
    if(regex.test(v)) console.log("ERRO (Deveria rejeitar): " + v);
});

console.log("Teste de Regex Concluído");
