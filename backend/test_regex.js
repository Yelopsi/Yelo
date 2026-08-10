const regex = /^[\p{L}\s\-'.,]+$/u;
const names = [
    "Dr. João da Silva",
    "Ana-Maria",
    "Conceição O'Brien, Psicóloga",
    "Müller",
    "João <script>",
    "Ana \"Maria\"",
    "Joao ; DROP TABLE",
    "João = 1"
];
names.forEach(n => console.log(n + " : " + regex.test(n)));
