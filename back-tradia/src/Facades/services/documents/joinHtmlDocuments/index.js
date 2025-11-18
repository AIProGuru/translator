const Mustache = require("mustache");
const fs = require("fs-extra");
const path = require("path");
const validate_html = require("./validateHtml");
const { z } = require("zod");
class HtmlJoiner {
	static template_html = fs.readFileSync(
		path.join(__dirname, "./template.html"),
		{
			encoding: "utf8",
		},
	);
	static error_html = fs.readFileSync(path.join(__dirname, "./error.html"), {
		encoding: "utf8",
	});
	static JOIN_SCHEMA = z.array(
		z.object({
			html: z.string(),
			html_info: z.object({
				page_number: z.number(),
				dimensions: z.object({
					width: z.number(),
					height: z.number(),
				}),
			}),
		}),
	);
	join(input) {
		const html_data = HtmlJoiner.JOIN_SCHEMA.parse(input);
		let styles = [];
		let bodys = [];
		for (const h of html_data) {
			const html = this.validate_html({
				html: h.html,
				html_info: h.html_info,
			});
			const strategy = this._handle_strategy(html);
			const { body, style } = strategy(html);
			if (body) bodys.push(body);
			if (style) styles.push(style);
		}
		const mergedHtml = this._inject_html(bodys, styles);
		return mergedHtml;
	}
	validate_html({ html, html_info }) {
		const validate = validate_html(html);
		if (validate.is_validate) return html;
		const htmlError = Mustache.render(HtmlJoiner.error_html, {
			html_info,
			json_error: JSON.stringify(validate.details, null, 2),
		});
		return htmlError;
	}
	_inject_html(bodys, styles) {
		if (!bodys.length)
			throw new Error(
				"No se pudo unir htmls porque no se pudo extraer nada para el Body",
			);
		const body = bodys.join("\n");
		const style = styles.length ? styles.join("\n") : "";

		const mergedHtml = Mustache.render(HtmlJoiner.template_html, {
			body,
			style,
		});
		return mergedHtml;
	}
	_handle_strategy(html) {
		if (/<\/html>/i.test(html)) {
			return this._strategy_full_html.bind(this);
		} else {
			return this._strategy_page_element.bind(this);
		}
	}
	_strategy_page_element(html) {
		return {
			body: html,
		};
	}
	_strategy_full_html(html) {
		function _extractBody(html) {
			const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
			return match ? match[1].trim() : null;
		}
		function _extractStyles(html) {
			const matches = [
				...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
			];
			return matches.map((m) => m[1].trim()).join("\n");
		}
		const body = _extractBody(html);
		const style = _extractStyles(html);
		return { body, style };
	}
}

module.exports = HtmlJoiner;
