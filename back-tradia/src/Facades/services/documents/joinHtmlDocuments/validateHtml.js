const { HTMLHint } = require("htmlhint");
function validate_html(htmlString) {
    HTMLHint.addRule({
        id: "no-multiple-html",
        description: "No debe haber múltiples elementos HTML",
        init: function(parser, reporter) {
            let htmlCount = 0;
            parser.addListener("tagstart", function(event) {
                if (event.tagName.toLowerCase() === "html") {
                    htmlCount++;
                    if (htmlCount > 1) {
                        reporter.error(
                            "Múltiples elementos HTML encontrados. Solo debe haber uno.",
                            event.line,
                            event.col,
                            this,
                            event.raw,
                        );
                    }
                }
            });
        },
    });

    HTMLHint.addRule({
        id: "no-multiple-body",
        description: "No debe haber múltiples elementos BODY",
        init: function(parser, reporter) {
            let bodyCount = 0;
            parser.addListener("tagstart", function(event) {
                if (event.tagName.toLowerCase() === "body") {
                    bodyCount++;
                    if (bodyCount > 1) {
                        reporter.error(
                            "Múltiples elementos BODY encontrados. Solo debe haber uno.",
                            event.line,
                            event.col,
                            this,
                            event.raw,
                        );
                    }
                }
            });
        },
    });

    const rules = {
        "doctype-first": false,
        "doctype-html5": false,
        "title-require": false,
        "id-unique": true,
        "style-disabled": false,
        "inline-style-disabled": false,
        "head-script-disabled": false,
        "spec-char-escape": false,
        "src-not-empty": false,
        "no-multiple-html": true,
        "no-multiple-body": true,
        "tag-pair": true,
    };

    const results = HTMLHint.verify(htmlString, rules);

    const validationResults = {
        isValid: results.length === 0,
        errors: results.filter((result) => result.type === "error"),
        //warnings: results.filter((result) => result.type === "warning"),
        summary: {
            errorCount: 0,
            warningCount: 0,
            details: [],
        },
    };

    results.forEach((result) => {
        if (result.type === "error") {
            validationResults.summary.errorCount++;
            validationResults.summary.details.push({
                type: result.type,
                rule: result.rule.id,
                line: result.line,
                col: result.col,
                message: result.message,
                evidence: result.evidence,
            });
        } else {
            validationResults.summary.warningCount++;
        }
    });
    return {
        is_validate: validationResults.isValid,
        details: validationResults,
    };
}
module.exports = validate_html;
