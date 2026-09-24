// Renderizador de Markdown mínimo y seguro para las respuestas del Dr. IA.
// Escapa todo el HTML primero y solo añade etiquetas conocidas.
(function () {
  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function inline(text) {
    // Los enlaces se apartan antes de aplicar negritas/cursivas para no romper sus URL.
    const links = [];
    const withPlaceholders = escapeHtml(text).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
      return `\u0000${links.length - 1}\u0000`;
    });
    return withPlaceholders
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|\s)_([^_]+)_(?=\s|[.,;:!?)]|$)/g, "$1<em>$2</em>")
      .replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
  }

  function render(markdown) {
    const lines = markdown.replace(/\r/g, "").split("\n");
    const html = [];
    let list = null; // "ul" | "ol"
    let paragraph = [];

    const flushParagraph = () => {
      if (paragraph.length) html.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (list) html.push(`</${list}>`);
      list = null;
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

      if (!line.trim()) {
        flushParagraph();
        closeList();
      } else if (heading) {
        flushParagraph();
        closeList();
        html.push(`<h3>${inline(heading[1])}</h3>`);
      } else if (bullet || numbered) {
        flushParagraph();
        const type = bullet ? "ul" : "ol";
        if (list !== type) {
          closeList();
          html.push(`<${type}>`);
          list = type;
        }
        html.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      } else if (/^-{3,}$/.test(line.trim())) {
        flushParagraph();
        closeList();
        html.push("<hr>");
      } else {
        closeList();
        paragraph.push(line.trim());
      }
    }
    flushParagraph();
    closeList();
    return html.join("");
  }

  window.Markdown = { render, escapeHtml };
})();
