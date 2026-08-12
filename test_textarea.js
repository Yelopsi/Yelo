const { JSDOM } = require('jsdom');
const dom = new JSDOM();
const document = dom.window.document;

let text1 = "&lt;p&gt;Sou &lt;strong&gt;Fernanda&lt;/strong&gt;&lt;/p&gt;";
let txt1 = document.createElement('textarea');
txt1.innerHTML = text1;
console.log("From escaped:", txt1.value);

let text2 = "<p>Sou <strong>Fernanda</strong></p>";
let txt2 = document.createElement('textarea');
txt2.innerHTML = text2;
console.log("From literal:", txt2.value);

