const fs = require("fs-extra");
const path = require("path");
const validate_html = require("../Facades/services/documents/joinHtmlDocuments/validateHtml.js");
const html = fs.readFileSync(path.join(__dirname, "./example_page.html"), {
	encoding: "utf8",
});
console.dir(validate_html(html), { depth: null });
