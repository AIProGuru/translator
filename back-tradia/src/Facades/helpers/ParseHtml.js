const cheerio = require("cheerio");
const Mustache = require("mustache");
const fs = require('fs');
const path = require('path')

class ParseHtml {
	constructor() {
		this.template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');;
	}

	parseHTML(htmlString) {
		try {
			const $ = cheerio.load(htmlString, {
				decodeEntities: true,
				normalizeWhitespace: false,
			});

			const styles = [];
			$("head style").each((i, elem) => {
				styles.push($(elem).html());
			});

			const templateData = {
				title: $("title").text() || "Documento",
				extractedStyles: styles.join("\n"),
				content: $("body").html(),
			};

			return {
				success: true,
				html: Mustache.render(this.template, templateData),
				parsedDocument: $,
				error: null,
			};
		} catch (error) {
			return {
				success: false,
				html: null,
				parsedDocument: null,
				error: `Error al parsear HTML: ${error.message}`,
			};
		}
	}

	validateWithCheerio($) {

		const validation = {
			isValid: true,
			errors: [],
			warnings: [],
			summary: {
				errorCount: 0,
				warningCount: 0,
				details: [],
			},
		};


		const addIssue = (type, message, element) => {
			const issue = {
				type,
				message,
				element: element ? $(element).toString() : null,
			};

			if (type === "error") {
				validation.errors.push(issue);
				validation.summary.errorCount++;
			} else {
				validation.warnings.push(issue);
				validation.summary.warningCount++;
			}

			validation.summary.details.push(issue);
			validation.isValid = validation.isValid && type !== "error";
		};

	
		const htmlElements = $("html");
		if (htmlElements.length === 0) {
			addIssue("error", "Falta el elemento html");
		} else if (htmlElements.length > 1) {
			htmlElements.each((index, element) => {
				if (index > 0) {

					addIssue(
						"error",
						`HTML duplicado encontrado (${index + 1} de ${
							htmlElements.length
						})`,
						element
					);
				}
			});
		}


		if (!$("head").length) {
			addIssue("error", "Falta el elemento head");
		}
		if (!$("body").length) {
			addIssue("error", "Falta el elemento body");
		}

		if (!$("title").length) {
			addIssue("error", "Falta el elemento title");
		}
		if (!$("meta[charset]").length) {
			addIssue("error", "Falta meta charset");
		}

		if (!$("html[lang]").length) {
			addIssue("warning", "El elemento html debe tener un atributo lang");
		}


		const ids = new Map();
		$("[id]").each((_, element) => {
			const id = $(element).attr("id");
			if (ids.has(id)) {
				addIssue("error", `ID duplicado encontrado: ${id}`, element);
			} else {
				ids.set(id, element);
			}
		});

	
		$("p, div, span, h1, h2, h3, h4, h5, h6").each((_, element) => {
			if (!$(element).text().trim() && !$(element).children().length) {
				addIssue(
					"warning",
					"Elemento sin contenido encontrado",
					element
				);
			}
		});

		const tagsRequiringClosure = [
			"div",
			"span",
			"p",
			"a",
			"button",
			"form",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"article",
			"section",
			"nav",
			"aside",
			"header",
			"footer",
			"main",
			"figure",
			"table",
			"tr",
			"td",
			"th",
			"ul",
			"ol",
			"li",
		];

		const selfClosingTags = [
			"img",
			"br",
			"hr",
			"input",
			"meta",
			"link",
			"area",
			"base",
			"col",
			"embed",
			"param",
			"source",
			"track",
			"wbr",
		];

		$("*").each((_, element) => {
			const tagName = element.tagName.toLowerCase();

			if (selfClosingTags.includes(tagName)) {
				return;
			}

			if (tagsRequiringClosure.includes(tagName)) {
				const html = $(element).toString();
				const openTag = `<${tagName}`;
				const closeTag = `</${tagName}>`;

				if (!html.includes(closeTag)) {
					addIssue(
						"error",
						`Etiqueta <${tagName}> sin cerrar correctamente`,
						element
					);
				}

				const openCount = (html.match(new RegExp(openTag, "g")) || [])
					.length;
				const closeCount = (html.match(new RegExp(closeTag, "g")) || [])
					.length;

				if (openCount !== closeCount) {
					addIssue(
						"error",
						`Desbalance de etiquetas ${tagName}: ${openCount} abiertas, ${closeCount} cerradas`,
						element
					);
				}
			}
		});

		return validation;
	}
	process(htmlString) {
		const parseResult = this.parseHTML(htmlString);
		if (!parseResult.success) {
			return {
				success: false,
				error: parseResult.error,
				validation: null,
				html: null,
			};
		}
		
		const validationResult = this.validateWithCheerio(
			parseResult.parsedDocument
		);

		return {
			success: true,
			html: parseResult.html,
			validation: validationResult,
			isValid: validationResult.isValid,
		};
	}
    generateResultObject(htmlString) {
        const result = this.process(htmlString);
        return {
            is_validate: result.isValid === true,
            html_out: result.html,
            html_error: result.isValid ? null : htmlString
        };
    }
}

module.exports = ParseHtml;
